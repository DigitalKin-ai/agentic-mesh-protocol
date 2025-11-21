import datetime

from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf import struct_pb2 as _struct_pb2
from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class Metadata(_message.Message):
    __slots__ = ()
    SECURITY_KEY_FIELD_NUMBER: _ClassVar[int]
    security_key: str
    def __init__(self, security_key: _Optional[str] = ...) -> None: ...

class Subscription(_message.Message):
    __slots__ = ()
    TIER_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    START_FIELD_NUMBER: _ClassVar[int]
    END_FIELD_NUMBER: _ClassVar[int]
    tier: str
    status: str
    start: _timestamp_pb2.Timestamp
    end: _timestamp_pb2.Timestamp
    def __init__(self, tier: _Optional[str] = ..., status: _Optional[str] = ..., start: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., end: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class Credits(_message.Message):
    __slots__ = ()
    ALLOCATED_FIELD_NUMBER: _ClassVar[int]
    USED_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_FIELD_NUMBER: _ClassVar[int]
    allocated: int
    used: int
    timestamp: _timestamp_pb2.Timestamp
    def __init__(self, allocated: _Optional[int] = ..., used: _Optional[int] = ..., timestamp: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class UserProfile(_message.Message):
    __slots__ = ()
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    ORGANISATION_ID_FIELD_NUMBER: _ClassVar[int]
    EMAIL_FIELD_NUMBER: _ClassVar[int]
    FIRST_NAME_FIELD_NUMBER: _ClassVar[int]
    LAST_NAME_FIELD_NUMBER: _ClassVar[int]
    CREATION_DATE_FIELD_NUMBER: _ClassVar[int]
    UPDATE_DATE_FIELD_NUMBER: _ClassVar[int]
    LOCALE_FIELD_NUMBER: _ClassVar[int]
    SUBSCRIPTION_FIELD_NUMBER: _ClassVar[int]
    CREDITS_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    organisation_id: str
    email: str
    first_name: str
    last_name: str
    creation_date: _timestamp_pb2.Timestamp
    update_date: _timestamp_pb2.Timestamp
    locale: str
    subscription: Subscription
    credits: Credits
    metadata: _struct_pb2.Struct
    def __init__(self, user_id: _Optional[str] = ..., organisation_id: _Optional[str] = ..., email: _Optional[str] = ..., first_name: _Optional[str] = ..., last_name: _Optional[str] = ..., creation_date: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., update_date: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., locale: _Optional[str] = ..., subscription: _Optional[_Union[Subscription, _Mapping]] = ..., credits: _Optional[_Union[Credits, _Mapping]] = ..., metadata: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...

class GetUserProfileRequest(_message.Message):
    __slots__ = ()
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    user_id: str
    def __init__(self, user_id: _Optional[str] = ...) -> None: ...

class GetUserProfileResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    USER_PROFILE_FIELD_NUMBER: _ClassVar[int]
    success: bool
    user_profile: UserProfile
    def __init__(self, success: _Optional[bool] = ..., user_profile: _Optional[_Union[UserProfile, _Mapping]] = ...) -> None: ...
