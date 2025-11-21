from buf.validate import validate_pb2 as _validate_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class CostType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    UNSPECIFIED: _ClassVar[CostType]
    TOKEN_INPUT: _ClassVar[CostType]
    TOKEN_OUTPUT: _ClassVar[CostType]
    API_CALL: _ClassVar[CostType]
    STORAGE: _ClassVar[CostType]
    TIME: _ClassVar[CostType]
    OTHER: _ClassVar[CostType]
UNSPECIFIED: CostType
TOKEN_INPUT: CostType
TOKEN_OUTPUT: CostType
API_CALL: CostType
STORAGE: CostType
TIME: CostType
OTHER: CostType

class Cost(_message.Message):
    __slots__ = ()
    COST_FIELD_NUMBER: _ClassVar[int]
    MISSION_ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    COST_TYPE_FIELD_NUMBER: _ClassVar[int]
    UNIT_FIELD_NUMBER: _ClassVar[int]
    RATE_FIELD_NUMBER: _ClassVar[int]
    SETUP_VERSION_ID_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    cost: float
    mission_id: str
    name: str
    cost_type: CostType
    unit: str
    rate: float
    setup_version_id: str
    quantity: float
    def __init__(self, cost: _Optional[float] = ..., mission_id: _Optional[str] = ..., name: _Optional[str] = ..., cost_type: _Optional[_Union[CostType, str]] = ..., unit: _Optional[str] = ..., rate: _Optional[float] = ..., setup_version_id: _Optional[str] = ..., quantity: _Optional[float] = ...) -> None: ...

class AddCostRequest(_message.Message):
    __slots__ = ()
    COST_FIELD_NUMBER: _ClassVar[int]
    MISSION_ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    COST_TYPE_FIELD_NUMBER: _ClassVar[int]
    UNIT_FIELD_NUMBER: _ClassVar[int]
    RATE_FIELD_NUMBER: _ClassVar[int]
    SETUP_VERSION_ID_FIELD_NUMBER: _ClassVar[int]
    QUANTITY_FIELD_NUMBER: _ClassVar[int]
    cost: float
    mission_id: str
    name: str
    cost_type: CostType
    unit: str
    rate: float
    setup_version_id: str
    quantity: float
    def __init__(self, cost: _Optional[float] = ..., mission_id: _Optional[str] = ..., name: _Optional[str] = ..., cost_type: _Optional[_Union[CostType, str]] = ..., unit: _Optional[str] = ..., rate: _Optional[float] = ..., setup_version_id: _Optional[str] = ..., quantity: _Optional[float] = ...) -> None: ...

class AddCostResponse(_message.Message):
    __slots__ = ()
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    success: bool
    def __init__(self, success: _Optional[bool] = ...) -> None: ...

class CostFilter(_message.Message):
    __slots__ = ()
    NAMES_FIELD_NUMBER: _ClassVar[int]
    COST_TYPES_FIELD_NUMBER: _ClassVar[int]
    SETUP_VERSION_IDS_FIELD_NUMBER: _ClassVar[int]
    names: _containers.RepeatedScalarFieldContainer[str]
    cost_types: _containers.RepeatedScalarFieldContainer[CostType]
    setup_version_ids: _containers.RepeatedScalarFieldContainer[str]
    def __init__(self, names: _Optional[_Iterable[str]] = ..., cost_types: _Optional[_Iterable[_Union[CostType, str]]] = ..., setup_version_ids: _Optional[_Iterable[str]] = ...) -> None: ...

class GetCostsRequest(_message.Message):
    __slots__ = ()
    MISSION_ID_FIELD_NUMBER: _ClassVar[int]
    FILTER_FIELD_NUMBER: _ClassVar[int]
    LIMIT_FIELD_NUMBER: _ClassVar[int]
    OFFSET_FIELD_NUMBER: _ClassVar[int]
    mission_id: str
    filter: CostFilter
    limit: int
    offset: int
    def __init__(self, mission_id: _Optional[str] = ..., filter: _Optional[_Union[CostFilter, _Mapping]] = ..., limit: _Optional[int] = ..., offset: _Optional[int] = ...) -> None: ...

class GetCostsResponse(_message.Message):
    __slots__ = ()
    COSTS_FIELD_NUMBER: _ClassVar[int]
    TOTAL_COUNT_FIELD_NUMBER: _ClassVar[int]
    TOTAL_COST_FIELD_NUMBER: _ClassVar[int]
    costs: _containers.RepeatedCompositeFieldContainer[Cost]
    total_count: int
    total_cost: float
    def __init__(self, costs: _Optional[_Iterable[_Union[Cost, _Mapping]]] = ..., total_count: _Optional[int] = ..., total_cost: _Optional[float] = ...) -> None: ...

class GetCostRequest(_message.Message):
    __slots__ = ()
    MISSION_ID_FIELD_NUMBER: _ClassVar[int]
    NAME_FIELD_NUMBER: _ClassVar[int]
    mission_id: str
    name: str
    def __init__(self, mission_id: _Optional[str] = ..., name: _Optional[str] = ...) -> None: ...

class GetCostResponse(_message.Message):
    __slots__ = ()
    COSTS_FIELD_NUMBER: _ClassVar[int]
    TOTAL_COST_FIELD_NUMBER: _ClassVar[int]
    costs: _containers.RepeatedCompositeFieldContainer[Cost]
    total_cost: float
    def __init__(self, costs: _Optional[_Iterable[_Union[Cost, _Mapping]]] = ..., total_cost: _Optional[float] = ...) -> None: ...
