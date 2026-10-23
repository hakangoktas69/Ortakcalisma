import importlib


def test_paket_ve_kurum_modulleri_yuklenir():
    for m in ["eworks_integration.core", "eworks_integration.institutions.gib", "eworks_integration.institutions.sgk"]:
        assert importlib.import_module(m)
