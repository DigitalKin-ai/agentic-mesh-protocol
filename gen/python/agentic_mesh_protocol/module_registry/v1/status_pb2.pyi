from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ModuleStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    MODULE_STATUS_UNSPECIFIED: _ClassVar[ModuleStatus]
    MODULE_STATUS_RUNNING: _ClassVar[ModuleStatus]
    MODULE_STATUS_IDLE: _ClassVar[ModuleStatus]
    MODULE_STATUS_ENDED: _ClassVar[ModuleStatus]
MODULE_STATUS_UNSPECIFIED: ModuleStatus
MODULE_STATUS_RUNNING: ModuleStatus
MODULE_STATUS_IDLE: ModuleStatus
MODULE_STATUS_ENDED: ModuleStatus

class ModuleStatusRequest(_message.Message):
    __slots__ = ()
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    module_id: str
    def __init__(self, module_id: _Optional[str] = ...) -> None: ...

class ModuleStatusResponse(_message.Message):
    __slots__ = ()
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    module_id: str
    status: ModuleStatus
    message: str
    def __init__(self, module_id: _Optional[str] = ..., status: _Optional[_Union[ModuleStatus, str]] = ..., message: _Optional[str] = ...) -> None: ...

class GetAllModulesStatusRequest(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class ListModulesStatusRequest(_message.Message):
    __slots__ = ()
    LIST_SIZE_FIELD_NUMBER: _ClassVar[int]
    OFFSET_FIELD_NUMBER: _ClassVar[int]
    list_size: int
    offset: int
    def __init__(self, list_size: _Optional[int] = ..., offset: _Optional[int] = ...) -> None: ...

class ListModulesStatusResponse(_message.Message):
    __slots__ = ()
    LIST_SIZE_FIELD_NUMBER: _ClassVar[int]
    MODULES_STATUSES_FIELD_NUMBER: _ClassVar[int]
    list_size: int
    modules_statuses: _containers.RepeatedCompositeFieldContainer[ModuleStatusResponse]
    def __init__(self, list_size: _Optional[int] = ..., modules_statuses: _Optional[_Iterable[_Union[ModuleStatusResponse, _Mapping]]] = ...) -> None: ...

class UpdateStatusRequest(_message.Message):
    __slots__ = ()
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    module_id: str
    status: ModuleStatus
    def __init__(self, module_id: _Optional[str] = ..., status: _Optional[_Union[ModuleStatus, str]] = ...) -> None: ...

class UpdateStatusResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    success: bool
    def __init__(self, success: _Optional[bool] = ...) -> None: ...
