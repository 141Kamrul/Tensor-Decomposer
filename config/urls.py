from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/index', include('tensor_decomposer.urls')),
    path('api/index/', include('tensor_decomposer.urls')),
    path('', include('tensor_decomposer.urls')),
]
