"""Wellbeing tests use a temporary database, never the department's data."""
import datetime as dt
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
import wellbeing


class WellbeingTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'wellbeing.sqlite3'
        self.day = dt.date(2026, 10, 19)
        self.clock = patch('wellbeing.today', side_effect=lambda: self.day)
        self.clock.start()
        self.store = wellbeing.WellbeingStore(self.path)
        app = FastAPI()
        app.include_router(wellbeing.make_router(Path(__file__).resolve().parent.parent, self.path))
        self.client = TestClient(app)

    def tearDown(self):
        self.clock.stop()
        self.temp.cleanup()

    def payload(self, number=1, **changes):
        data = dict(day=self.day.isoformat(), slot='morning', token=f'{number:064x}', consent=True,
                    wellbeing=3, energy=4, calm=2, context=5)
        data.update(changes)
        return data

    def send(self, number=1, **changes):
        return self.client.post('/api/wellbeing/checkins', json=self.payload(number, **changes))

    def test_local_page_has_no_department_scripts(self):
        page = self.client.get('/checkin')
        self.assertEqual(page.status_code, 200)
        self.assertNotIn('seed.js', page.text)
        self.assertNotIn('src="static/app.js"', page.text)
        self.assertIn('no-store', page.headers['cache-control'])

    def test_opt_in_strict_validation_and_no_personal_fields(self):
        for change in ({'consent':False},{'consent':1},{'wellbeing':0},{'energy':6},{'calm':True},
                       {'context':1.5},{'person_id':'E01'},{'comment':'personal note'},
                       {'day':'2026-10-18'},{'day':'2026-10-20'},{'token':'bad'},{'slot':'night'}):
            with self.subTest(change=change):
                self.assertIn(self.send(**change).status_code, (400,422))
        with self.store.connect() as c:
            self.assertEqual(c.execute('SELECT count(*) FROM buckets').fetchone()[0],0)

    def test_duplicates_are_idempotent_and_slots_are_independent(self):
        self.assertEqual(self.send().json()['status'],'received')
        self.assertEqual(self.send(wellbeing=1).json()['status'],'already_received')
        self.assertEqual(self.send(slot='evening').json()['status'],'received')
        with self.store.connect() as c:
            rows=list(c.execute('SELECT * FROM buckets'))
            self.assertEqual([r['n'] for r in rows],[1,1])
            self.assertEqual(json.loads(rows[0]['sums'])['wellbeing'],3)

    def test_current_week_never_leaks_scores_or_response_count(self):
        for number in range(1,7): self.send(number)
        data=self.client.get('/api/wellbeing/summary').json()
        self.assertEqual(data['weeks'],[])
        self.assertNotIn('responses',json.dumps(data))
        self.assertNotIn('means',json.dumps(data))

    def test_threshold_counts_browsers_per_slot_not_marks(self):
        for offset in range(5):
            self.day=dt.date(2026,10,19)+dt.timedelta(days=offset)
            for number in range(1,5): self.send(number)
        self.day=dt.date(2026,10,26)
        slots=self.store.summary()['weeks'][0]['slots']
        self.assertEqual(slots['morning'],{'status':'insufficient'})
        self.assertEqual(slots['evening'],{'status':'insufficient'})

    def test_week_closes_once_and_removes_identifiers(self):
        for number in range(1,6): self.send(number,wellbeing=number)
        self.send(1,slot='evening')
        self.day=dt.date(2026,10,26)
        result=self.store.summary()['weeks'][0]['slots']
        self.assertEqual(result['morning']['means']['wellbeing'],3)
        self.assertEqual(result['morning']['responses'],5)
        self.assertEqual(result['morning']['browsers'],5)
        self.assertEqual(result['evening'],{'status':'insufficient'})
        self.send(1)
        self.assertEqual(self.store.summary()['weeks'][0]['slots'],result)
        with self.store.connect() as c:
            for table in ('receipts','participants','salts','buckets'):
                self.assertEqual(c.execute(f'SELECT count(*) FROM {table} WHERE week=?',('2026-10-19',)).fetchone()[0],0)

    def test_no_raw_scores_linked_to_identifier_or_raw_token(self):
        self.send()
        with self.store.connect() as c:
            dump='\n'.join(c.iterdump())
            self.assertNotIn(self.payload()['token'],dump)
            columns={r[1] for r in c.execute('PRAGMA table_info(receipts)')}
            self.assertEqual(columns,{'week','day','slot','digest'})
            columns={r[1] for r in c.execute('PRAGMA table_info(buckets)')}
            self.assertEqual(columns,{'week','slot','n','sums'})

    def test_retention_and_foreign_origin(self):
        response=self.client.post('/api/wellbeing/checkins',json=self.payload(),headers={'Origin':'https://foreign.example'})
        self.assertEqual(response.status_code,403)
        for number in range(1,6): self.send(number)
        self.day=dt.date(2027,1,18)
        self.assertEqual(self.store.summary()['weeks'],[])


if __name__ == '__main__':
    unittest.main()
