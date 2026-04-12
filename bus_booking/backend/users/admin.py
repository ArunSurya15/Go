from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import OperatorStaffInvite, User


@admin.register(OperatorStaffInvite)
class OperatorStaffInviteAdmin(admin.ModelAdmin):
    list_display = ("email", "role", "operator", "created_at", "expires_at", "accepted_at")
    list_filter = ("role",)
    readonly_fields = ("token", "created_at")


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "role", "operator", "operator_staff_role")
    list_filter = ("role", "operator_staff_role")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Role", {"fields": ("role", "operator", "operator_staff_role")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Role", {"fields": ("role", "operator", "operator_staff_role")}),
    )