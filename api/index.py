import os
import sys

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cwd = os.getcwd()

for p in (root_dir, cwd):
    if p not in sys.path:
        sys.path.insert(0, p)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from django.core.wsgi import get_wsgi_application

_application = get_wsgi_application()

def app(environ, start_response):
    path = environ.get('PATH_INFO', '')
    if path.startswith('/api/index'):
        path = path[len('/api/index'):]
    if not path:
        path = '/'
    
    environ['PATH_INFO'] = path
    environ['SCRIPT_NAME'] = ''
    if 'REQUEST_URI' in environ:
        req_uri = environ['REQUEST_URI']
        if req_uri.startswith('/api/index'):
            environ['REQUEST_URI'] = req_uri[len('/api/index'):] or '/'
            
    return _application(environ, start_response)

handler = app
