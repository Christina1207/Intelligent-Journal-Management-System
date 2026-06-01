from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, Role


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "name"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
    )
    password_confirm = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "orcid",
            "affiliation",
            "country",
        ]
        extra_kwargs = {
            "first_name": {"required": True},
            "last_name": {"required": True},
            "affiliation": {"required": False},
            "country": {"required": False},
        }

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")

        user = User(**validated_data)
        user.set_password(password)
        user.save()

        # Every registered user gets AUTHOR role by default
        #TODO: In the future, we may want to allow users to select additional roles during registration like reviewer
        author_role = Role.objects.get(name=Role.RoleName.AUTHOR)
        user.roles.add(author_role)

        return user


class UserProfileSerializer(serializers.ModelSerializer):
    roles = RoleSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "orcid",
            "affiliation",
            "country",
            "status",
            "roles",
        ]
        read_only_fields = ["id", "status", "roles"]