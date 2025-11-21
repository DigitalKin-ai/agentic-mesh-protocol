from agentic_mesh_protocol.module_registry.v1 import metadata_pb2 as _metadata_pb2
from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class DiscoverSearchRequest(_message.Message):
    __slots__ = ()
    MODULE_TYPE_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    TAGS_FIELD_NUMBER: _ClassVar[int]
    DESCRIPTION_FIELD_NUMBER: _ClassVar[int]
    module_type: str
    name: str
    tags: _containers.RepeatedCompositeFieldContainer[_metadata_pb2.Tag]
    description: str
    def __init__(self, module_type: _Optional[str] = ..., name: _Optional[str] = ..., tags: _Optional[_Iterable[_Union[_metadata_pb2.Tag, _Mapping]]] = ..., description: _Optional[str] = ...) -> None: ...

class DiscoverSearchResponse(_message.Message):
    __slots__ = ()
    MODULES_FIELD_NUMBER: _ClassVar[int]
    modules: _containers.RepeatedCompositeFieldContainer[DiscoverInfoResponse]
    def __init__(self, modules: _Optional[_Iterable[_Union[DiscoverInfoResponse, _Mapping]]] = ...) -> None: ...

class DiscoverInfoRequest(_message.Message):
    __slots__ = ()
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    module_id: str
    def __init__(self, module_id: _Optional[str] = ...) -> None: ...

class DiscoverInfoResponse(_message.Message):
    __slots__ = ()
    MODULE_ID_FIELD_NUMBER: _ClassVar[int]
    MODULE_TYPE_FIELD_NUMBER: _ClassVar[int]
    ADDRESS_FIELD_NUMBER: _ClassVar[int]
    PORT_FIELD_NUMBER: _ClassVar[int]
    VERSION_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    module_id: str
    module_type: str
    address: str
    port: int
    version: str
    metadata: _metadata_pb2.Metadata
    def __init__(self, module_id: _Optional[str] = ..., module_type: _Optional[str] = ..., address: _Optional[str] = ..., port: _Optional[int] = ..., version: _Optional[str] = ..., metadata: _Optional[_Union[_metadata_pb2.Metadata, _Mapping]] = ...) -> None: ...
