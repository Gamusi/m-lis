import os
import re
import glob
import pytest

def test_legacy_files_exist():
    assert os.path.exists('frontend/static/js/app.js'), 'Legacy app.js must be preserved'
    assert os.path.exists('frontend/static/index.html'), 'Legacy index.html must be preserved'

def get_app_methods(filepath):
    methods = set()
    if not os.path.exists(filepath):
        return methods
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    pattern = re.compile(r'^\s{2,4}([a-zA-Z0-9_]+)\s*:\s*(?:function|__async)', re.MULTILINE)
    for match in pattern.finditer(content):
        methods.add(match.group(1))
    return methods

def test_legacy_method_inventory_count():
    legacy_methods = get_app_methods('frontend/static/js/app.js')
    assert len(legacy_methods) >= 180, f'Expected >= 180, found {len(legacy_methods)}'

def test_no_forbidden_es2017_syntax_in_modular_js():
    js_files = glob.glob('frontend/static/js/core/*.js') + glob.glob('frontend/static/js/modules/*.js')
    forbidden = [
        (re.compile(r'async\s+function'), 'async function (use __async generator coroutine)'),
        (re.compile(r'await\s+[a-zA-Z0-9_]'), 'await keyword (use yield in __async)'),
        (re.compile(r'\?\.[a-zA-Z0-9_]'), 'optional chaining (?.)'),
        (re.compile(r'\?\?'), 'nullish coalescing (??)'),
    ]
    for fp in js_files:
        with open(fp, 'r', encoding='utf-8') as f:
            t = f.read()
        for rg, name in forbidden:
            assert not rg.search(t), f'Forbidden {name} in {fp}'
