import copy
import unittest
from advisor_records import merge_advisor_records
from test_institution_records import fixture, OWNER, IDENTITY

ADVISOR='0987654321'


class AdvisorScopeTests(unittest.TestCase):
    def batch(self):
        batch=fixture()
        batch.update(accessMode='advisor',observedAccountIdentity=ADVISOR,
                     observedTaxpayerIdentity=IDENTITY,contractNumber='TEST-CONTRACT')
        return batch

    def merge(self,batch,**changes):
        args=dict(owner_id=OWNER,advisor_identity=ADVISOR,identity=IDENTITY,year=2026,
            contracts=[dict(taxNumber=IDENTITY,number='TEST-CONTRACT',type='Aracılık ve Sorumluluk Sözleşmesi')],
            authorized_identities=frozenset({IDENTITY}),authorization_module='notices')
        args.update(changes)
        return merge_advisor_records([],batch,**args)

    def test_scope_audit_and_no_mutation(self):
        batch=self.batch(); before=copy.deepcopy(batch)
        result=self.merge(batch)
        self.assertEqual(batch,before)
        self.assertEqual(result[0]['advisorIdentity'],ADVISOR)
        self.assertEqual(result[0]['identity'],IDENTITY)
        self.assertEqual(result[0]['accessMode'],'advisor')

    def test_contract_does_not_replace_observed_module_access(self):
        with self.assertRaises(ValueError):
            self.merge(self.batch(),authorized_identities=frozenset())
        with self.assertRaises(ValueError):
            self.merge(self.batch(),authorization_module='declarations')

    def test_module_access_does_not_replace_contract(self):
        with self.assertRaises(ValueError): self.merge(self.batch(),contracts=[])
        with self.assertRaises(ValueError):
            self.merge(self.batch(),contracts=[dict(taxNumber=IDENTITY,number='TEST-CONTRACT',type='Aracılık Sözleşmesi')])

    def test_wrong_advisor_client_owner_or_contract_rejected(self):
        for key,value in [('observedAccountIdentity',IDENTITY),('observedTaxpayerIdentity',ADVISOR),
                          ('ownerId','OTHER'),('contractNumber','OTHER')]:
            batch=self.batch();batch[key]=value
            with self.assertRaises(ValueError): self.merge(batch)
