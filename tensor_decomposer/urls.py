from django.urls import path

from .views import download_result, home

urlpatterns = [
    path('', home, name='home'),
    path('download/<str:filename>/', download_result, name='download_result'),
]
