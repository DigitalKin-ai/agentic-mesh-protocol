from agentic_mesh_protocol.setup.v1 import setup_pb2 as _setup_pb2
from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf import struct_pb2 as _struct_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class ConfigSetupModuleRequest(_message.Message):
    __slots__ = ()
    SETUP_VERSION_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    MISSION_ID_FIELD_NUMBER: _ClassVar[int]
    setup_version: _setup_pb2.SetupVersion
    content: _struct_pb2.Struct
    mission_id: str
    def __init__(self, setup_version: _Optional[_Union[_setup_pb2.SetupVersion, _Mapping]] = ..., content: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ..., mission_id: _Optional[str] = ...) -> None: ...

class ConfigSetupModuleResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    SETUP_VERSION_FIELD_NUMBER: _ClassVar[int]
    success: bool
    setup_version: _setup_pb2.SetupVersion
    def __init__(self, success: _Optional[bool] = ..., setup_version: _Optional[_Union[_setup_pb2.SetupVersion, _Mapping]] = ...) -> None: ...

class StartModuleRequest(_message.Message):
    __slots__ = ()
    INPUT_FIELD_NUMBER: _ClassVar[int]
    SETUP_ID_FIELD_NUMBER: _ClassVar[int]
    MISSION_ID_FIELD_NUMBER: _ClassVar[int]
    input: _struct_pb2.Struct
    setup_id: str
    mission_id: str
    def __init__(self, input: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ..., setup_id: _Optional[str] = ..., mission_id: _Optional[str] = ...) -> None: ...

class StopModuleRequest(_message.Message):
    __slots__ = ()
    JOB_ID_FIELD_NUMBER: _ClassVar[int]
    job_id: str
    def __init__(self, job_id: _Optional[str] = ...) -> None: ...

class StartModuleResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_FIELD_NUMBER: _ClassVar[int]
    JOB_ID_FIELD_NUMBER: _ClassVar[int]
    success: bool
    output: _struct_pb2.Struct
    job_id: str
    def __init__(self, success: _Optional[bool] = ..., output: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ..., job_id: _Optional[str] = ...) -> None: ...

class StopModuleResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    JOB_ID_FIELD_NUMBER: _ClassVar[int]
    success: bool
    job_id: str
    def __init__(self, success: _Optional[bool] = ..., job_id: _Optional[str] = ...) -> None: ...
