from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf import struct_pb2 as _struct_pb2
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class GetModuleInputRequest(_message.Message):
    __slots__ = ()
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    LLM_FORMAT_FIELD_NUMBER: _ClassVar[int]
    module_id: str
    llm_format: bool
    def __init__(self, module_id: _Optional[str] = ..., llm_format: _Optional[bool] = ...) -> None: ...

class GetModuleOutputRequest(_message.Message):
    __slots__ = ()
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    LLM_FORMAT_FIELD_NUMBER: _ClassVar[int]
    module_id: str
    llm_format: bool
    def __init__(self, module_id: _Optional[str] = ..., llm_format: _Optional[bool] = ...) -> None: ...

class GetModuleSetupRequest(_message.Message):
    __slots__ = ()
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    LLM_FORMAT_FIELD_NUMBER: _ClassVar[int]
    module_id: str
    llm_format: bool
    def __init__(self, module_id: _Optional[str] = ..., llm_format: _Optional[bool] = ...) -> None: ...

class GetModuleSecretRequest(_message.Message):
    __slots__ = ()
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    LLM_FORMAT_FIELD_NUMBER: _ClassVar[int]
    module_id: str
    llm_format: bool
    def __init__(self, module_id: _Optional[str] = ..., llm_format: _Optional[bool] = ...) -> None: ...

class GetModuleInputResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    INPUT_SCHEMA_FIELD_NUMBER: _ClassVar[int]
    success: bool
    input_schema: _struct_pb2.Struct
    def __init__(self, success: _Optional[bool] = ..., input_schema: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...

class GetModuleOutputResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    OUTPUT_SCHEMA_FIELD_NUMBER: _ClassVar[int]
    success: bool
    output_schema: _struct_pb2.Struct
    def __init__(self, success: _Optional[bool] = ..., output_schema: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...

class GetModuleSetupResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    SETUP_SCHEMA_FIELD_NUMBER: _ClassVar[int]
    success: bool
    setup_schema: _struct_pb2.Struct
    def __init__(self, success: _Optional[bool] = ..., setup_schema: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...

class GetModuleSecretResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    SECRET_SCHEMA_FIELD_NUMBER: _ClassVar[int]
    success: bool
    secret_schema: _struct_pb2.Struct
    def __init__(self, success: _Optional[bool] = ..., secret_schema: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...

class GetConfigSetupModuleRequest(_message.Message):
    __slots__ = ()
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    LLM_FORMAT_FIELD_NUMBER: _ClassVar[int]
    module_id: str
    llm_format: bool
    def __init__(self, module_id: _Optional[str] = ..., llm_format: _Optional[bool] = ...) -> None: ...

class GetConfigSetupModuleResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    CONFIG_SETUP_SCHEMA_FIELD_NUMBER: _ClassVar[int]
    success: bool
    config_setup_schema: _struct_pb2.Struct
    def __init__(self, success: _Optional[bool] = ..., config_setup_schema: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...
