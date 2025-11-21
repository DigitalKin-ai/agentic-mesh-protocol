import datetime

from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf import struct_pb2 as _struct_pb2
from google.protobuf import timestamp_pb2 as _timestamp_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class SetupStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    DRAFT: _ClassVar[SetupStatus]
    VALIDATING: _ClassVar[SetupStatus]
    READY: _ClassVar[SetupStatus]
    PAUSED: _ClassVar[SetupStatus]
    FAILED: _ClassVar[SetupStatus]
    ARCHIVED: _ClassVar[SetupStatus]
    NEEDS_CONFIGURATION: _ClassVar[SetupStatus]
    CONFIGURATION_FAILED: _ClassVar[SetupStatus]
    CONFIGURATION_SUCCEEDED: _ClassVar[SetupStatus]
DRAFT: SetupStatus
VALIDATING: SetupStatus
READY: SetupStatus
PAUSED: SetupStatus
FAILED: SetupStatus
ARCHIVED: SetupStatus
NEEDS_CONFIGURATION: SetupStatus
CONFIGURATION_FAILED: SetupStatus
CONFIGURATION_SUCCEEDED: SetupStatus

class SetupVersion(_message.Message):
    __slots__ = ()
    ID_FIELD_NUMBER: _ClassVar[int]
    SETUP_ID_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    CREATION_DATE_FIELD_NUMBER: _ClassVar[int]
    id: str
    setup_id: str
    version: str
    content: _struct_pb2.Struct
    creation_date: _timestamp_pb2.Timestamp
    def __init__(self, id: _Optional[str] = ..., setup_id: _Optional[str] = ..., version: _Optional[str] = ..., content: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ..., creation_date: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ...) -> None: ...

class Setup(_message.Message):
    __slots__ = ()
    ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    ORGANISATION_ID_FIELD_NUMBER: _ClassVar[int]
    OWNER_ID_FIELD_NUMBER: _ClassVar[int]
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    CURRENT_SETUP_VERSION_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    id: str
    name: str
    organisation_id: str
    owner_id: str
    module_id: str
    current_setup_version: SetupVersion
    status: SetupStatus
    def __init__(self, id: _Optional[str] = ..., name: _Optional[str] = ..., organisation_id: _Optional[str] = ..., owner_id: _Optional[str] = ..., module_id: _Optional[str] = ..., current_setup_version: _Optional[_Union[SetupVersion, _Mapping]] = ..., status: _Optional[_Union[SetupStatus, str]] = ...) -> None: ...

class CreateSetupRequest(_message.Message):
    __slots__ = ()
    NAME_FIELD_NUMBER: _ClassVar[int]
    ORGANISATION_ID_FIELD_NUMBER: _ClassVar[int]
    OWNER_ID_FIELD_NUMBER: _ClassVar[int]
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    CURRENT_SETUP_VERSION_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    name: str
    organisation_id: str
    owner_id: str
    module_id: str
    current_setup_version: SetupVersion
    status: SetupStatus
    def __init__(self, name: _Optional[str] = ..., organisation_id: _Optional[str] = ..., owner_id: _Optional[str] = ..., module_id: _Optional[str] = ..., current_setup_version: _Optional[_Union[SetupVersion, _Mapping]] = ..., status: _Optional[_Union[SetupStatus, str]] = ...) -> None: ...

class CreateSetupResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    SETUP_FIELD_NUMBER: _ClassVar[int]
    success: bool
    setup: Setup
    def __init__(self, success: _Optional[bool] = ..., setup: _Optional[_Union[Setup, _Mapping]] = ...) -> None: ...

class GetSetupRequest(_message.Message):
    __slots__ = ()
    SETUP_ID_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    setup_id: str
    version: str
    def __init__(self, setup_id: _Optional[str] = ..., version: _Optional[str] = ...) -> None: ...

class GetSetupResponse(_message.Message):
    __slots__ = ()
    SETUP_FIELD_NUMBER: _ClassVar[int]
    SETUP_VERSION_FIELD_NUMBER: _ClassVar[int]
    setup: Setup
    setup_version: SetupVersion
    def __init__(self, setup: _Optional[_Union[Setup, _Mapping]] = ..., setup_version: _Optional[_Union[SetupVersion, _Mapping]] = ...) -> None: ...

class UpdateSetupRequest(_message.Message):
    __slots__ = ()
    SETUP_ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    OWNER_ID_FIELD_NUMBER: _ClassVar[int]
    CURRENT_SETUP_VERSION_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    setup_id: str
    name: str
    owner_id: str
    current_setup_version: SetupVersion
    status: SetupStatus
    def __init__(self, setup_id: _Optional[str] = ..., name: _Optional[str] = ..., owner_id: _Optional[str] = ..., current_setup_version: _Optional[_Union[SetupVersion, _Mapping]] = ..., status: _Optional[_Union[SetupStatus, str]] = ...) -> None: ...

class UpdateSetupResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    SETUP_FIELD_NUMBER: _ClassVar[int]
    success: bool
    setup: Setup
    def __init__(self, success: _Optional[bool] = ..., setup: _Optional[_Union[Setup, _Mapping]] = ...) -> None: ...

class DeleteSetupRequest(_message.Message):
    __slots__ = ()
    SETUP_ID_FIELD_NUMBER: _ClassVar[int]
    setup_id: str
    def __init__(self, setup_id: _Optional[str] = ...) -> None: ...

class DeleteSetupResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    success: bool
    def __init__(self, success: _Optional[bool] = ...) -> None: ...

class CreateSetupVersionRequest(_message.Message):
    __slots__ = ()
    SETUP_ID_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    setup_id: str
    version: str
    content: _struct_pb2.Struct
    def __init__(self, setup_id: _Optional[str] = ..., version: _Optional[str] = ..., content: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...

class CreateSetupVersionResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    SETUP_VERSION_FIELD_NUMBER: _ClassVar[int]
    success: bool
    setup_version: SetupVersion
    def __init__(self, success: _Optional[bool] = ..., setup_version: _Optional[_Union[SetupVersion, _Mapping]] = ...) -> None: ...

class GetSetupVersionRequest(_message.Message):
    __slots__ = ()
    SETUP_VERSION_ID_FIELD_NUMBER: _ClassVar[int]
    setup_version_id: str
    def __init__(self, setup_version_id: _Optional[str] = ...) -> None: ...

class GetSetupVersionResponse(_message.Message):
    __slots__ = ()
    SETUP_VERSION_FIELD_NUMBER: _ClassVar[int]
    setup_version: SetupVersion
    def __init__(self, setup_version: _Optional[_Union[SetupVersion, _Mapping]] = ...) -> None: ...

class SearchSetupVersionsRequest(_message.Message):
    __slots__ = ()
    SETUP_ID_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    setup_id: str
    version: str
    def __init__(self, setup_id: _Optional[str] = ..., version: _Optional[str] = ...) -> None: ...

class SearchSetupVersionsResponse(_message.Message):
    __slots__ = ()
    SETUP_VERSIONS_FIELD_NUMBER: _ClassVar[int]
    setup_versions: _containers.RepeatedCompositeFieldContainer[SetupVersion]
    def __init__(self, setup_versions: _Optional[_Iterable[_Union[SetupVersion, _Mapping]]] = ...) -> None: ...

class UpdateSetupVersionRequest(_message.Message):
    __slots__ = ()
    SETUP_VERSION_ID_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    setup_version_id: str
    version: str
    content: _struct_pb2.Struct
    def __init__(self, setup_version_id: _Optional[str] = ..., version: _Optional[str] = ..., content: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...

class UpdateSetupVersionResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    SETUP_VERSION_FIELD_NUMBER: _ClassVar[int]
    success: bool
    setup_version: SetupVersion
    def __init__(self, success: _Optional[bool] = ..., setup_version: _Optional[_Union[SetupVersion, _Mapping]] = ...) -> None: ...

class DeleteSetupVersionRequest(_message.Message):
    __slots__ = ()
    SETUP_VERSION_ID_FIELD_NUMBER: _ClassVar[int]
    setup_version_id: str
    def __init__(self, setup_version_id: _Optional[str] = ...) -> None: ...

class DeleteSetupVersionResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    success: bool
    def __init__(self, success: _Optional[bool] = ...) -> None: ...

class ListSetupsRequest(_message.Message):
    __slots__ = ()
    ORGANISATION_ID_FIELD_NUMBER: _ClassVar[int]
    OWNER_ID_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    OFFSET_FIELD_NUMBER: _ClassVar[int]
    organisation_id: str
    owner_id: str
    limit: int
    offset: int
    def __init__(self, organisation_id: _Optional[str] = ..., owner_id: _Optional[str] = ..., limit: _Optional[int] = ..., offset: _Optional[int] = ...) -> None: ...

class ListSetupsResponse(_message.Message):
    __slots__ = ()
    SETUPS_FIELD_NUMBER: _ClassVar[int]
    TOTAL_COUNT_FIELD_NUMBER: _ClassVar[int]
    setups: _containers.RepeatedCompositeFieldContainer[Setup]
    total_count: int
    def __init__(self, setups: _Optional[_Iterable[_Union[Setup, _Mapping]]] = ..., total_count: _Optional[int] = ...) -> None: ...
