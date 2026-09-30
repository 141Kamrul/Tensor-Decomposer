import os
import sys

# Ensure root directory is on sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cwd = os.getcwd()

for p in (root_dir, cwd):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from django.core.wsgi import get_wsgi_application

_application = get_wsgi_application()

def app(environ, start_response):
    path_info = environ.get('PATH_INFO', '')
    if path_info == '/api/index':
        environ['PATH_INFO'] = '/'
    elif path_info.startswith('/api/index/'):
        environ['PATH_INFO'] = path_info[len('/api/index'):]
    return _application(environ, start_response)

handler = app
