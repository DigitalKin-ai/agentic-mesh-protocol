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

class FileType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    FILE_TYPE_UNSPECIFIED: _ClassVar[FileType]
    FILE_TYPE_DOCUMENT: _ClassVar[FileType]
    FILE_TYPE_IMAGE: _ClassVar[FileType]
    FILE_TYPE_VIDEO: _ClassVar[FileType]
    FILE_TYPE_AUDIO: _ClassVar[FileType]
    FILE_TYPE_ARCHIVE: _ClassVar[FileType]
    FILE_TYPE_CODE: _ClassVar[FileType]
    FILE_TYPE_OTHER: _ClassVar[FileType]

class FileStatus(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    FILE_STATUS_UNSPECIFIED: _ClassVar[FileStatus]
    FILE_STATUS_UPLOADING: _ClassVar[FileStatus]
    FILE_STATUS_ACTIVE: _ClassVar[FileStatus]
    FILE_STATUS_PROCESSING: _ClassVar[FileStatus]
    FILE_STATUS_ARCHIVED: _ClassVar[FileStatus]
    FILE_STATUS_DELETED: _ClassVar[FileStatus]
FILE_TYPE_UNSPECIFIED: FileType
FILE_TYPE_DOCUMENT: FileType
FILE_TYPE_IMAGE: FileType
FILE_TYPE_VIDEO: FileType
FILE_TYPE_AUDIO: FileType
FILE_TYPE_ARCHIVE: FileType
FILE_TYPE_CODE: FileType
FILE_TYPE_OTHER: FileType
FILE_STATUS_UNSPECIFIED: FileStatus
FILE_STATUS_UPLOADING: FileStatus
FILE_STATUS_ACTIVE: FileStatus
FILE_STATUS_PROCESSING: FileStatus
FILE_STATUS_ARCHIVED: FileStatus
FILE_STATUS_DELETED: FileStatus

class File(_message.Message):
    __slots__ = ()
    FILE_ID_FIELD_NUMBER: _ClassVar[int]
    CONTEXT_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    FILE_TYPE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    SIZE_BYTES_FIELD_NUMBER: _ClassVar[int]
    CHECKSUM_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    STORAGE_URI_FIELD_NUMBER: _ClassVar[int]
    FILE_URL_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    file_id: str
    context: str
    name: str
    file_type: FileType
    content_type: str
    size_bytes: int
    checksum: str
    metadata: _struct_pb2.Struct
    storage_uri: str
    file_url: str
    status: FileStatus
    content: bytes
    def __init__(self, file_id: _Optional[str] = ..., context: _Optional[str] = ..., name: _Optional[str] = ..., file_type: _Optional[_Union[FileType, str]] = ..., content_type: _Optional[str] = ..., size_bytes: _Optional[int] = ..., checksum: _Optional[str] = ..., metadata: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ..., storage_uri: _Optional[str] = ..., file_url: _Optional[str] = ..., status: _Optional[_Union[FileStatus, str]] = ..., content: _Optional[bytes] = ...) -> None: ...

class FileFilter(_message.Message):
    __slots__ = ()
    NAMES_FIELD_NUMBER: _ClassVar[int]
    FILE_IDS_FIELD_NUMBER: _ClassVar[int]
    FILE_TYPES_FIELD_NUMBER: _ClassVar[int]
    CONTEXT_FIELD_NUMBER: _ClassVar[int]
    CREATED_AFTER_FIELD_NUMBER: _ClassVar[int]
    CREATED_BEFORE_FIELD_NUMBER: _ClassVar[int]
    UPDATED_AFTER_FIELD_NUMBER: _ClassVar[int]
    UPDATED_BEFORE_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_PREFIX_FIELD_NUMBER: _ClassVar[int]
    MIN_SIZE_BYTES_FIELD_NUMBER: _ClassVar[int]
    MAX_SIZE_BYTES_FIELD_NUMBER: _ClassVar[int]
    PREFIX_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    names: _containers.RepeatedScalarFieldContainer[str]
    file_ids: _containers.RepeatedScalarFieldContainer[str]
    file_types: _containers.RepeatedScalarFieldContainer[FileType]
    context: str
    created_after: _timestamp_pb2.Timestamp
    created_before: _timestamp_pb2.Timestamp
    updated_after: _timestamp_pb2.Timestamp
    updated_before: _timestamp_pb2.Timestamp
    status: FileStatus
    content_type_prefix: str
    min_size_bytes: int
    max_size_bytes: int
    prefix: str
    content_type: str
    def __init__(self, names: _Optional[_Iterable[str]] = ..., file_ids: _Optional[_Iterable[str]] = ..., file_types: _Optional[_Iterable[_Union[FileType, str]]] = ..., context: _Optional[str] = ..., created_after: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., created_before: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., updated_after: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., updated_before: _Optional[_Union[datetime.datetime, _timestamp_pb2.Timestamp, _Mapping]] = ..., status: _Optional[_Union[FileStatus, str]] = ..., content_type_prefix: _Optional[str] = ..., min_size_bytes: _Optional[int] = ..., max_size_bytes: _Optional[int] = ..., prefix: _Optional[str] = ..., content_type: _Optional[str] = ...) -> None: ...

class FileResult(_message.Message):
    __slots__ = ()
    FILE_FIELD_NUMBER: _ClassVar[int]
    ERROR_FIELD_NUMBER: _ClassVar[int]
    file: File
    error: str
    def __init__(self, file: _Optional[_Union[File, _Mapping]] = ..., error: _Optional[str] = ...) -> None: ...

class UploadFileData(_message.Message):
    __slots__ = ()
    CONTEXT_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    FILE_TYPE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    REPLACE_IF_EXISTS_FIELD_NUMBER: _ClassVar[int]
    context: str
    name: str
    file_type: FileType
    content_type: str
    content: bytes
    metadata: _struct_pb2.Struct
    status: FileStatus
    replace_if_exists: bool
    def __init__(self, context: _Optional[str] = ..., name: _Optional[str] = ..., file_type: _Optional[_Union[FileType, str]] = ..., content_type: _Optional[str] = ..., content: _Optional[bytes] = ..., metadata: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ..., status: _Optional[_Union[FileStatus, str]] = ..., replace_if_exists: _Optional[bool] = ...) -> None: ...

class UploadFilesRequest(_message.Message):
    __slots__ = ()
    FILES_FIELD_NUMBER: _ClassVar[int]
    files: _containers.RepeatedCompositeFieldContainer[UploadFileData]
    def __init__(self, files: _Optional[_Iterable[_Union[UploadFileData, _Mapping]]] = ...) -> None: ...

class UploadFilesResponse(_message.Message):
    __slots__ = ()
    RESULTS_FIELD_NUMBER: _ClassVar[int]
    TOTAL_UPLOADED_FIELD_NUMBER: _ClassVar[int]
    TOTAL_FAILED_FIELD_NUMBER: _ClassVar[int]
    results: _containers.RepeatedCompositeFieldContainer[FileResult]
    total_uploaded: int
    total_failed: int
    def __init__(self, results: _Optional[_Iterable[_Union[FileResult, _Mapping]]] = ..., total_uploaded: _Optional[int] = ..., total_failed: _Optional[int] = ...) -> None: ...

class GetFileRequest(_message.Message):
    __slots__ = ()
    CONTEXT_FIELD_NUMBER: _ClassVar[int]
    FILE_ID_FIELD_NUMBER: _ClassVar[int]
    INCLUDE_CONTENT_FIELD_NUMBER: _ClassVar[int]
    context: str
    file_id: str
    include_content: bool
    def __init__(self, context: _Optional[str] = ..., file_id: _Optional[str] = ..., include_content: _Optional[bool] = ...) -> None: ...

class GetFileResponse(_message.Message):
    __slots__ = ()
    FILE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    file: File
    content: bytes
    def __init__(self, file: _Optional[_Union[File, _Mapping]] = ..., content: _Optional[bytes] = ...) -> None: ...

class UpdateFileRequest(_message.Message):
    __slots__ = ()
    CONTEXT_FIELD_NUMBER: _ClassVar[int]
    FILE_ID_FIELD_NUMBER: _ClassVar[int]
    NEW_NAME_FIELD_NUMBER: _ClassVar[int]
    FILE_TYPE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    CONTENT_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    context: str
    file_id: str
    new_name: str
    file_type: FileType
    content_type: str
    content: bytes
    status: FileStatus
    metadata: _struct_pb2.Struct
    def __init__(self, context: _Optional[str] = ..., file_id: _Optional[str] = ..., new_name: _Optional[str] = ..., file_type: _Optional[_Union[FileType, str]] = ..., content_type: _Optional[str] = ..., content: _Optional[bytes] = ..., status: _Optional[_Union[FileStatus, str]] = ..., metadata: _Optional[_Union[_struct_pb2.Struct, _Mapping]] = ...) -> None: ...

class UpdateFileResponse(_message.Message):
    __slots__ = ()
    RESULT_FIELD_NUMBER: _ClassVar[int]
    result: FileResult
    def __init__(self, result: _Optional[_Union[FileResult, _Mapping]] = ...) -> None: ...

class GetFilesRequest(_message.Message):
    __slots__ = ()
    CONTEXT_FIELD_NUMBER: _ClassVar[int]
    FILTERS_FIELD_NUMBER: _ClassVar[int]
    LIST_SIZE_FIELD_NUMBER: _ClassVar[int]
    OFFSET_FIELD_NUMBER: _ClassVar[int]
    ORDER_FIELD_NUMBER: _ClassVar[int]
    INCLUDE_CONTENT_FIELD_NUMBER: _ClassVar[int]
    context: str
    filters: FileFilter
    list_size: int
    offset: int
    order: str
    include_content: bool
    def __init__(self, context: _Optional[str] = ..., filters: _Optional[_Union[FileFilter, _Mapping]] = ..., list_size: _Optional[int] = ..., offset: _Optional[int] = ..., order: _Optional[str] = ..., include_content: _Optional[bool] = ...) -> None: ...

class GetFilesResponse(_message.Message):
    __slots__ = ()
    FILES_FIELD_NUMBER: _ClassVar[int]
    TOTAL_COUNT_FIELD_NUMBER: _ClassVar[int]
    files: _containers.RepeatedCompositeFieldContainer[File]
    total_count: int
    def __init__(self, files: _Optional[_Iterable[_Union[File, _Mapping]]] = ..., total_count: _Optional[int] = ...) -> None: ...

class DeleteFilesRequest(_message.Message):
    __slots__ = ()
    CONTEXT_FIELD_NUMBER: _ClassVar[int]
    FILTERS_FIELD_NUMBER: _ClassVar[int]
    FORCE_FIELD_NUMBER: _ClassVar[int]
    PERMANENT_FIELD_NUMBER: _ClassVar[int]
    context: str
    filters: FileFilter
    force: bool
    permanent: bool
    def __init__(self, context: _Optional[str] = ..., filters: _Optional[_Union[FileFilter, _Mapping]] = ..., force: _Optional[bool] = ..., permanent: _Optional[bool] = ...) -> None: ...

class DeleteFilesResponse(_message.Message):
    __slots__ = ()
    class ResultsEntry(_message.Message):
        __slots__ = ()
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: bool
        def __init__(self, key: _Optional[str] = ..., value: _Optional[bool] = ...) -> None: ...
    RESULTS_FIELD_NUMBER: _ClassVar[int]
    TOTAL_DELETED_FIELD_NUMBER: _ClassVar[int]
    TOTAL_FAILED_FIELD_NUMBER: _ClassVar[int]
    results: _containers.ScalarMap[str, bool]
    total_deleted: int
    total_failed: int
    def __init__(self, results: _Optional[_Mapping[str, bool]] = ..., total_deleted: _Optional[int] = ..., total_failed: _Optional[int] = ...) -> None: ...
