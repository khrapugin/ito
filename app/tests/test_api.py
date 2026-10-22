"""Run with python -m unittest discover -s tests. Never opens the user's database."""
import copy
import importlib
import io
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from fastapi.testclient import TestClient
from openpyxl import Workbook

TEST_ROOT = Path(__file__).parent / 'runtime'
TEST_ROOT.mkdir(exist_ok=True)
os.environ['ITO_DB_PATH'] = str(TEST_ROOT / 'api.sqlite3')
app_module = importlib.import_module('app')

class ApiTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app_module.app)
        self.base = app_module.normalize(json.loads((app_module.ROOT / 'static' / 'seed.json').read_text(encoding='utf-8')))
        with app_module.connect() as c:
            c.execute('UPDATE app_state SET revision=1,payload=? WHERE id=1', (json.dumps(self.base, ensure_ascii=False),))

    def test_atomic_save_and_stale_revision(self):
        data = copy.deepcopy(self.base)
        data['people'][0]['weekly'] = 32
        response = self.client.put('/api/state', json={'revision':1,'data':data})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['revision'], 2)
        self.assertEqual(self.client.put('/api/state', json={'revision':1,'data':self.base}).status_code, 409)
        self.assertEqual(self.client.get('/api/state').json()['data']['people'][0]['weekly'], 32)

    def test_invalid_records_do_not_write(self):
        for change in ['negative', 'orphan', 'bad_week', 'nan', 'missing_title', 'missing_hours']:
            with self.subTest(change=change):
                data = copy.deepcopy(self.base)
                if change == 'negative': data['assignments'][0]['hours'] = -1
                if change == 'orphan': data['assignments'][0]['person_id'] = 'MISSING'
                if change == 'bad_week': data['assignments'][0]['week'] = '2026-10-20'
                if change == 'nan': data['assignments'][0]['hours'] = 'NaN'
                if change == 'missing_title': data['tasks'][0]['title'] = ''
                if change == 'missing_hours': del data['assignments'][0]['hours']
                self.assertEqual(self.client.put('/api/state',json={'revision':1,'data':data}).status_code,400)
                self.assertEqual(self.client.get('/api/state').json()['revision'],1)

    def test_snapshot_cannot_be_modified(self):
        data = copy.deepcopy(self.base)
        data['snapshots'] += [{'week':'2026-10-19','people':data['people'],'entries':[{'task_id':data['tasks'][0]['id'],'hours':8}]}]
        self.assertEqual(self.client.put('/api/state',json={'revision':1,'data':data}).status_code,200)
        data['snapshots'][0]['entries'][0]['hours'] = 4
        self.assertEqual(self.client.put('/api/state',json={'revision':2,'data':data}).status_code,400)

    def test_restore_saves_backup_and_roundtrips(self):
        response=self.client.post('/api/restore',json={'revision':1,'data':self.base})
        self.assertEqual(response.status_code,200)
        self.assertTrue(list((TEST_ROOT / 'backups').glob('*.json')))
        backup=self.client.get('/api/backup.json').json()
        self.assertEqual(backup['version'],5)
        self.assertEqual(backup['data']['tasks'],self.base['tasks'])

    def test_csv_preview_is_read_only(self):
        csv=b'external_id;task_id;person_id;day;hours\nA;T1;D1;2026-10-21;2\n'
        r=self.client.post('/api/import/preview?kind=actuals',files={'file':('sample.csv',csv,'text/csv')})
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['items'][0]['hours'],'2')
        self.assertEqual(self.client.get('/api/state').json()['revision'],1)
        empty=self.client.post('/api/import/preview?kind=actuals',files={'file':('empty.csv',b'','text/csv')})
        self.assertEqual(empty.status_code,400)

    def test_xlsx_dates_normalized(self):
        import datetime
        wb=Workbook();sh=wb.active
        sh.append(['external_id','task_id','person_id','day','hours'])
        sh.append(['A','T1','D1',datetime.date(2026,10,21),2.5])
        stream=io.BytesIO();wb.save(stream)
        r=self.client.post('/api/import/preview?kind=actuals',files={'file':('sample.xlsx',stream.getvalue(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['items'][0]['day'],'2026-10-21')

    def test_entrypoints(self):
        self.assertEqual(self.client.get('/').status_code,200)
        self.assertEqual(self.client.get('/static/core.js').status_code,200)
        self.assertEqual(self.client.get('/methodology',follow_redirects=False).status_code,307)

if __name__ == '__main__':
    unittest.main()
