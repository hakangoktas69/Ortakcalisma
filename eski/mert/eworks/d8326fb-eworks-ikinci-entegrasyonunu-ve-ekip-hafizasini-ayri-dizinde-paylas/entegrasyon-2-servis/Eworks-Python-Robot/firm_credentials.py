"""Firma Vault erişimi; müşavir hesabına geri dönüş yapmaz, diske yazmaz."""
from uuid import UUID
import requests
from cloud_credentials import URL, PUBLISHABLE_KEY


def fetch_firm_credentials(access_token, owner, firm_id, identity):
    if (not isinstance(firm_id, str) or not 1 <= len(firm_id.strip()) <= 160
            or not isinstance(identity, str) or not identity.isdigit()
            or len(identity) not in (10, 11)):
        raise ValueError('Firma ve VKN/TCKN gerekli.')
    try:
        owner = str(UUID(owner))
        response = requests.post(URL+'/functions/v1/gib-account',
            json={'action': 'robot', 'firmId': firm_id},
            headers={'apikey': PUBLISHABLE_KEY, 'Authorization': 'Bearer '+access_token},
            timeout=15, allow_redirects=False)
        if response.status_code != 200:
            raise ValueError()
        value = response.json()
        if (value.get('scope') != 'firm' or value.get('firmId') != firm_id
                or value.get('ownerId') != owner
                or identity not in (value.get('taxNumber'), value.get('identityNumber'))
                or not isinstance(value.get('username'), str)
                or not 1 <= len(value['username'].strip()) <= 256
                or not isinstance(value.get('password'), str)
                or not 1 <= len(value['password']) <= 1024):
            raise ValueError()
        return {'username': value['username'], 'password': value['password']}
    except (requests.RequestException, ValueError, TypeError, AttributeError):
        raise ValueError('Firmaya özel GİB hesabı doğrulanamadı. Müşavir hesabı kullanılmadı.') from None
