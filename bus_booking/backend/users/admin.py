from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "role", "operator")
    list_filter = ("role",)
    fieldsets = BaseUserAdmin.fieldsets + (("Role", {"fields": ("role", "operator")}),)
    add_fieldsets = BaseUserAdmin.add_fieldsets + (("Role", {"fields": ("role", "operator")}),)