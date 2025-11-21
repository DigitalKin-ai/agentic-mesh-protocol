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
    MODULE_STATUS_STARTING: _ClassVar[ModuleStatus]
    MODULE_STATUS_PROCESSING: _ClassVar[ModuleStatus]
    MODULE_STATUS_CANCELED: _ClassVar[ModuleStatus]
    MODULE_STATUS_FAILED: _ClassVar[ModuleStatus]
    MODULE_STATUS_EXPIRED: _ClassVar[ModuleStatus]
    MODULE_STATUS_SUCCESS: _ClassVar[ModuleStatus]
    MODULE_STATUS_STOPPED: _ClassVar[ModuleStatus]
MODULE_STATUS_UNSPECIFIED: ModuleStatus
MODULE_STATUS_STARTING: ModuleStatus
MODULE_STATUS_PROCESSING: ModuleStatus
MODULE_STATUS_CANCELED: ModuleStatus
MODULE_STATUS_FAILED: ModuleStatus
MODULE_STATUS_EXPIRED: ModuleStatus
MODULE_STATUS_SUCCESS: ModuleStatus
MODULE_STATUS_STOPPED: ModuleStatus

class JobInfo(_message.Message):
    __slots__ = ()
    JOB_ID_FIELD_NUMBER: _ClassVar[int]
    JOB_STATUS_FIELD_NUMBER: _ClassVar[int]
    job_id: str
    job_status: ModuleStatus
    def __init__(self, job_id: _Optional[str] = ..., job_status: _Optional[_Union[ModuleStatus, str]] = ...) -> None: ...

class GetModuleStatusRequest(_message.Message):
    __slots__ = ()
    JOB_ID_FIELD_NUMBER: _ClassVar[int]
    job_id: str
    def __init__(self, job_id: _Optional[str] = ...) -> None: ...

class GetModuleStatusResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    JOB_ID_FIELD_NUMBER: _ClassVar[int]
    success: bool
    status: ModuleStatus
    job_id: str
    def __init__(self, success: _Optional[bool] = ..., status: _Optional[_Union[ModuleStatus, str]] = ..., job_id: _Optional[str] = ...) -> None: ...

class GetModuleJobsRequest(_message.Message):
    __slots__ = ()
    def __init__(self) -> None: ...

class GetModuleJobsResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    JOBS_FIELD_NUMBER: _ClassVar[int]
    success: bool
    jobs: _containers.RepeatedCompositeFieldContainer[JobInfo]
    def __init__(self, success: _Optional[bool] = ..., jobs: _Optional[_Iterable[_Union[JobInfo, _Mapping]]] = ...) -> None: ...
