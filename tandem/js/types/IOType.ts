// Copyright 2020-2025, University of Colorado Boulder

/**
 * IOTypes form a synthetic type system used to describe PhET-iO Elements. A PhET-iO Element is an instrumented PhetioObject
 * that is interoperable from the "wrapper" frame (outside the sim frame). An IOType includes documentation, methods,
 * names, serialization, etc.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 */

import validate from '../../../axon/js/validate.js';
import Validation, { Validator } from '../../../axon/js/Validation.js';
import optionize from '../../../phet-core/js/optionize.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import { IOTypeName, Method, Methods, PhetioElementMetadata, PhetioType } from '../phet-io-types.js';
import PhetioConstants from '../PhetioConstants.js';
import type PhetioDynamicElementContainer from '../PhetioDynamicElementContainer.js';
import type PhetioObject from '../PhetioObject.js';
import TandemConstants from '../TandemConstants.js';
import tandemNamespace from '../tandemNamespace.js';
import StateSchema, { APIStateKeys, CompositeSchema, CompositeStateObjectType } from './StateSchema.js';

// constants
const VALIDATE_OPTIONS_FALSE = { validateValidator: false };

const truthy = ( x: IntentionalAny ): boolean => !!x;

// Global flag that triggers pruning the state object down to only that which gets tracked by the PhET-iO API, see
// apiStateKeys to opt into api state tracking
let GETTING_STATE_FOR_API = false;
let API_STATE_NESTED_COUNT = 0;

// Sometimes, it doesn't matter what the parameters of the IOType are. `unknown` most often doesn't work here.
export type AnyIOType = IOType<IntentionalAny, IntentionalAny>;

/**
 * Estimate the core type name from a given IOType name.
 */
const getCoreTypeName = ( ioTypeName: IOTypeName ): string => {
  const index = ioTypeName.indexOf( PhetioConstants.IO_TYPE_SUFFIX );
  assert && assert( index >= 0, 'IO should be in the type name' );
  return ioTypeName.substring( 0, index );
};

type AddChildElement = ( group: PhetioDynamicElementContainer<PhetioObject>, componentName: string, stateObject: unknown ) => PhetioObject;

export type IOTypeMethod = {
  returnType: AnyIOType;
  parameterTypes: AnyIOType[];

  //the function to execute when this method is called. This function's parameters will be based on `parameterTypes`,
  // and should return the type specified by `returnType`
  implementation: ( ...args: IntentionalAny[] ) => unknown;
  documentation: string;

  // by default, all methods are invocable for all elements. However, for some read-only elements, certain methods
  // should not be invocable. In that case, they are marked as invocableForReadOnlyElements: false.
  invocableForReadOnlyElements?: boolean;
};

type DeserializationType = 'fromStateObject' | 'applyState';

type StateSchemaOption<T, StateType extends SelfStateType, SelfStateType> = (
  ( ioType: IOType<T, StateType, SelfStateType> ) => CompositeSchema<SelfStateType> ) |
  StateSchema<T, StateType> |
  CompositeSchema<SelfStateType> |
  null;

type SelfOptions<T, StateType extends SelfStateType, SelfStateType> = {

  // IOTypes form an object tree like a type hierarchy. If the supertype is specified, attributes such as
  // toStateObject, fromStateObject, stateObjectToCreateElementArguments, applyState, addChildElement
  // will be inherited from the supertype (unless overridden).  It is also used in features such as schema validation,
  // data/metadata default calculations.
  supertype?: AnyIOType | null;

  // The list of events that can be emitted at this level (does not include events from supertypes).
  events?: string[];

  // Key/value pairs indicating the defaults for the IOType data, just for this level (do not specify parent defaults)
  dataDefaults?: Record<string, unknown>;

  // Key/value pairs indicating the defaults for the IOType metadata.
  // If anything is provided here, then corresponding PhetioObjects that use this IOType should override
  // PhetioObject.getMetadata() to add what keys they need for their specific type.  Cannot specify redundant values
  // (that an ancestor already specified).
  metadataDefaults?: Partial<PhetioElementMetadata>;

  // Text that describes the IOType, presented to the PhET-iO Client in Studio, supports HTML markup.
  documentation?: string;

  // The public methods available for this IOType. Each method is not just a function,
  // but a collection of metadata about the method to be able to serialize parameters and return types and provide
  // better documentation.
  methods?: Record<string, IOTypeMethod>;

  // IOTypes can specify the order that methods appear in the documentation by putting their names in this
  // list. This list is only for the methods defined at this level in the type hierarchy. After the methodOrder
  // specified, the methods follow in the order declared in the implementation (which isn't necessarily stable).
  methodOrder?: string[];

  // For parametric types, they must indicate the types of the parameters here. Empty array if non-parametric.
  parameterTypes?: AnyIOType[];

  // For internal phet-io use only. Functions cannot be sent from one iframe to another, so must be wrapped. See
  // phetioCommandProcessor.wrapFunction
  isFunctionType?: boolean;

  fuzzElement?: ( ( element: T, log: boolean ) => void ) | null;

  // ******** STATE ******** //

  // The specification for how the PhET-iO state will look for instances of this type. null specifies that the object
  // is not serialized. A composite StateSchema can supply a toStateObject and applyState serialization strategy. This
  // default serialization strategy only applies to this level, and does not recurse to parents. If you need to add
  // serialization from parent levels, this can be done by manually implementing a custom toStateObject. By default, it
  // will assume that each composite child of this stateSchema deserializes via "fromStateObject", if instead it uses
  // applyState, please specify that per IOType with defaultDeserializationMethod.
  // For phetioState: true objects, this should be required, but may be specified in the parent IOType, like in DerivedPropertyIO
  stateSchema?: StateSchemaOption<T, StateType, SelfStateType>;

  /**
   * A list of keys found in this IOType's composite state that should be API tracked.
   * Initial states are tracked in api file for each stateful instance, this means that those value changes can
   * trigger api changes. This doesn't occur by default, so instead you must opt into to value-based api tracking like
   * this.
   * This option is mostly recognizing that it is less than ideal the metadata the describes what kind of values
   * a PhEt-iO Element could be are in state, even though they probably shouldn't be. Like PropertyIO.validValues. We
   * are likely never going to change that, due to complexity and backwards compatibility needs, so this option allows
   * API tracking for state like that, without incurring the cost of tracking useless value changes (PropertyIO.value,
   * for example).
   *
   * By default, state used by another PhET-iO Element that is opting into api tracking will be added to the API. For
   * example, because PropertyIO.validValues opts into api tracking, a PropertyIO<RangeIO> will show validValues with full
   * RangeIO state objects in it. This is because RangeIO doesn't provide any apiStateKeys. Thus, we say that nested
   * state objects are "opt out" for this behavior, since you could remove the min/max keys from the above example if
   * you provided apiStateKeys:[], instead of the default of "null".
   *
   * NOTE! These are still just values! They will still be set for state, and it doesn't exclude you from any state-like
   * behavior. This option doesn't change anything for state-setting, just for the logic of API comparison/compatibility
   * checking.
   *
   * Solution developed in https://github.com/phetsims/phet-io/issues/1951
   */
  apiStateKeys?: APIStateKeys | null;

  // Serialize the core object. Most often this looks like an object literal that holds data about the PhetioObject
  // instance. This is likely superfluous to just providing a stateSchema of composite key/IOType values, which will
  // create a default toStateObject based on the schema.
  toStateObject?: ( ( t: T ) => StateType ) | null;

  // ******** DESERIALIZATION ******** //

  // For Data Type Deserialization. Decodes the object from a state (see toStateObject) into an instance of the core type.
  // see https://github.com/phetsims/phet-io/blob/main/doc/phet-io-instrumentation-technical-guide.md#three-types-of-deserialization
  fromStateObject?: ( ( s: StateType ) => T ) | null;

  // For Dynamic Element Deserialization: converts the state object to arguments
  // for a `create` function in PhetioGroup or other PhetioDynamicElementContainer creation function. Note that
  // other non-serialized args (not dealt with here) may be supplied as closure variables. This function only needs
  // to be implemented on IOTypes whose core type is phetioDynamicElement: true, such as PhetioDynamicElementContainer
  // elements.
  // see https://github.com/phetsims/phet-io/blob/main/doc/phet-io-instrumentation-technical-guide.md#three-types-of-deserialization
  stateObjectToCreateElementArguments?: ( ( s: StateType ) => unknown[] ) | null;

  // For Reference Type Deserialization:  Applies the state (see toStateObject)
  // value to the instance. When setting PhET-iO state, this function will be called on an instrumented instance to set the
  // stateObject's value to it. StateSchema makes this method often superfluous. A composite stateSchema can be used
  // to automatically formulate the applyState function. If using stateSchema for the applyState method, make sure that
  // each compose IOType has the correct defaultDeserializationMethod. Most of the time, composite IOTypes use fromStateObject
  // to deserialize each sub-component, but in some circumstances, you will want your child to deserialize by also using applyState.
  // See options.defaultDeserializationMethod to configure this case.
  // see https://github.com/phetsims/phet-io/blob/main/doc/phet-io-instrumentation-technical-guide.md#three-types-of-deserialization
  applyState?: ( ( t: T, state: StateType ) => void ) | null;

  // For use when this IOType is part of a composite stateSchema in another IOType.  When
  // using serialization methods by supplying only stateSchema, then deserialization
  // can take a variety of forms, and this will vary based on the IOType. In most cases deserialization of a component
  // is done via fromStateObject. If not, specify this option so that the stateSchema will be able to know to call
  // the appropriate deserialization method when deserializing something of this IOType.
  defaultDeserializationMethod?: DeserializationType;

  // For dynamic element containers, see examples in IOTypes for PhetioDynamicElementContainer classes
  addChildElement?: AddChildElement;
};

type IOTypeOptions<T, StateType extends SelfStateType, SelfStateType> = SelfOptions<T, StateType, SelfStateType> & Validator<T>;

// StateType is the whole thing, SelfStateType is just at this level
export default class IOType<T = never, StateType extends SelfStateType = never, SelfStateType = StateType> {

  // See documentation in options type declaration
  public readonly supertype?: AnyIOType;
  public readonly documentation?: string;
  public readonly methods?: Record<string, IOTypeMethod>;
  public readonly events: string[];
  public readonly metadataDefaults?: Partial<PhetioElementMetadata>;
  public readonly dataDefaults?: Record<string, unknown>;
  public readonly methodOrder?: string[];
  public readonly parameterTypes?: AnyIOType[];

  private readonly toStateObjectOption: ( ( t: T ) => StateType ) | null;
  public readonly fromStateObjectOption: ( ( state: StateType ) => T ) | null;
  private readonly applyStateOption: ( ( t: T, state: StateType ) => void ) | null;

  // TODO: instead of unknown this is the second parameter type for PhetioDynamicElementContainer. How? https://github.com/phetsims/tandem/issues/261
  public readonly stateObjectToCreateElementArgumentsOption: ( ( s: StateType ) => unknown[] ) | null;

  public readonly addChildElement: AddChildElement;
  public readonly validator: Validator<T>;
  public readonly defaultDeserializationMethod: DeserializationType;
  public readonly isFunctionType: boolean;

  // The StateSchema (type) that the option is made into. The option is more flexible than the class.
  public readonly stateSchema: StateSchema<T, SelfStateType> | null;

  public readonly fuzzElement: Required<SelfOptions<T, StateType, SelfStateType>>['fuzzElement'];

  // The base IOType for the entire hierarchy.
  public static ObjectIO: IOType<PhetioObject, null>;

  private readonly toStateObjectSupplied: boolean;
  private readonly stateSchemaSupplied: boolean;
  private readonly applyStateSupplied: boolean;

  /**
   * @param typeName - The name that this IOType will have in the public PhET-iO API. In general, this should
   *    only be word characters, ending in "IO". Parametric types are a special subset of IOTypes that include their
   *    parameters in their typeName. If an IOType's parameters are other IOType(s), then they should be included within
   *    angle brackets, like "PropertyIO<BooleanIO>". Some other types use a more custom format for displaying their
   *    parameter types, in this case the parameter section of the type name (immediately following "IO") should begin
   *    with an open paren, "(". Thus the schema for a typeName could be defined (using regex) as `[A-Z]\w*IO([(<].*){0,1}`.
   *    Parameterized types should also include a `parameterTypes` field on the IOType.
   * @param providedOptions
   */
  public constructor( public readonly typeName: IOTypeName, providedOptions: IOTypeOptions<T, StateType, SelfStateType> ) {

    // For reference in the options
    const supertype = providedOptions.supertype || IOType.ObjectIO;
    const toStateObjectSupplied = !!( providedOptions.toStateObject );
    const applyStateSupplied = !!( providedOptions.applyState );
    const stateSchemaSupplied = !!( providedOptions.stateSchema );

    const options = optionize<IOTypeOptions<T, StateType, SelfStateType>, SelfOptions<T, StateType, SelfStateType>>()( {

      supertype: IOType.ObjectIO,
      methods: {},
      events: [],
      metadataDefaults: {},

      //  Most likely this will remain PhET-iO internal, and shouldn't need to be used when creating IOTypes outside of tandem/.
      dataDefaults: {},
      methodOrder: [],
      parameterTypes: [],
      documentation: `PhET-iO Type for ${getCoreTypeName( typeName )}`,
      isFunctionType: false,

      fuzzElement: null,

      /**** STATE ****/

      toStateObject: null,
      fromStateObject: null,
      stateObjectToCreateElementArguments: null,
      applyState: null,

      stateSchema: null,
      apiStateKeys: null,
      defaultDeserializationMethod: 'fromStateObject',
      addChildElement: supertype && supertype.addChildElement
    }, providedOptions );

    if ( assert && supertype ) {
      ( Object.keys( options.metadataDefaults ) as ( keyof PhetioElementMetadata )[] ).forEach( metadataDefaultKey => {
        assert && supertype.getAllMetadataDefaults().hasOwnProperty( metadataDefaultKey ) &&
        assert( supertype.getAllMetadataDefaults()[ metadataDefaultKey ] !== options.metadataDefaults[ metadataDefaultKey ],
          `${metadataDefaultKey} should not have the same default value as the ancestor metadata default.` );
      } );
    }
    this.supertype = supertype;
    this.documentation = options.documentation;
    this.methods = options.methods;
    this.events = options.events;
    this.metadataDefaults = options.metadataDefaults;
    this.dataDefaults = options.dataDefaults;
    this.methodOrder = options.methodOrder;
    this.parameterTypes = options.parameterTypes;
    this.fuzzElement = options.fuzzElement;

    // Validation
    this.validator = _.pick( options, Validation.VALIDATOR_KEYS );
    this.validator.validationMessage = this.validator.validationMessage || `Validation failed IOType Validator: ${this.typeName}`;

    this.defaultDeserializationMethod = options.defaultDeserializationMethod;

    if ( options.stateSchema === null || options.stateSchema instanceof StateSchema ) {
      this.stateSchema = options.stateSchema as ( null | StateSchema<T, SelfStateType> );
    }
    else {
      const compositeSchema = typeof options.stateSchema === 'function' ? options.stateSchema( this ) : options.stateSchema;

      this.stateSchema = new StateSchema<T, SelfStateType>( {
        compositeSchema: compositeSchema,
        apiStateKeys: options.apiStateKeys
      } );
    }

    // Assert that toStateObject method is provided for value StateSchemas. Do this with the following logic:
    // 1. It is acceptable to not provide a stateSchema (for IOTypes that aren't stateful)
    // 2. You must either provide a toStateObject, or have a composite StateSchema. Composite state schemas support default serialization methods.
    assert && assert( !this.stateSchema || ( toStateObjectSupplied || this.stateSchema.isComposite() ),
      'toStateObject method must be provided for value StateSchemas' );

    this.toStateObjectOption = options.toStateObject;
    this.fromStateObjectOption = options.fromStateObject;
    this.applyStateOption = options.applyState;
    this.stateObjectToCreateElementArgumentsOption = options.stateObjectToCreateElementArguments;

    this.toStateObjectSupplied = toStateObjectSupplied;
    this.applyStateSupplied = applyStateSupplied;
    this.stateSchemaSupplied = stateSchemaSupplied;
    this.isFunctionType = options.isFunctionType;
    this.addChildElement = options.addChildElement;

    if ( assert ) {

      assert && assert( supertype || this.typeName === 'ObjectIO', 'supertype is required' );
      assert && assert( !this.typeName.includes( '.' ), 'Dots should not appear in type names' );
      assert && assert( this.typeName.split( /[<(]/ )[ 0 ].endsWith( PhetioConstants.IO_TYPE_SUFFIX ), `IOType name must end with ${PhetioConstants.IO_TYPE_SUFFIX}` );
      assert && assert( this.hasOwnProperty( 'typeName' ), 'this.typeName is required' );

      // assert that each public method adheres to the expected schema
      this.methods && Object.values( this.methods ).forEach( ( methodObject: IOTypeMethod ) => {
        if ( typeof methodObject === 'object' ) {
          assert && methodObject.invocableForReadOnlyElements && assert( typeof methodObject.invocableForReadOnlyElements === 'boolean',
            `invocableForReadOnlyElements must be of type boolean: ${methodObject.invocableForReadOnlyElements}` );
        }
      } );
      assert && assert( this.documentation.length > 0, 'documentation must be provided' );

      this.methods && this.hasOwnProperty( 'methodOrder' ) && this.methodOrder.forEach( methodName => {
        assert && assert( this.methods![ methodName ], `methodName not in public methods: ${methodName}` );
      } );

      if ( supertype ) {
        const typeHierarchy = supertype.getTypeHierarchy();
        assert && this.events && this.events.forEach( event => {

          // Make sure events are not listed again
          assert && assert( !_.some( typeHierarchy, t => t.events.includes( event ) ), `IOType should not declare event that parent also has: ${event}` );
        } );

        if ( this.stateSchema?.apiStateKeys ) {
          const supertypeAPIKeys = supertype.getAllAPIStateKeys();
          this.stateSchema?.apiStateKeys.forEach( apiStateKey => {
            assert && assert( !supertypeAPIKeys.includes( apiStateKey ), `apiStateKey is already in the super: ${apiStateKey}` );
          } );
        }
      }
      else {

        // The root IOType must supply all 4 state methods.
        assert && assert( typeof options.toStateObject === 'function', 'toStateObject must be defined' );
        assert && assert( typeof options.fromStateObject === 'function', 'fromStateObject must be defined' );
        assert && assert( typeof options.stateObjectToCreateElementArguments === 'function', 'stateObjectToCreateElementArguments must be defined' );
        assert && assert( typeof options.applyState === 'function', 'applyState must be defined' );
      }
    }
  }

  public toStateObject( coreObject: T ): StateType {
    API_STATE_NESTED_COUNT++;
    // validate( coreObject, this.validator, VALIDATE_OPTIONS_FALSE );

    let stateObject;

    // Only do this non-standard toStateObject function if there is a stateSchema but no toStateObject provided
    if ( !this.toStateObjectSupplied && this.stateSchemaSupplied && this.stateSchema && this.stateSchema.isComposite() ) {
      stateObject = this.defaultToStateObject( coreObject );
    }
    else {
      assert && !this.toStateObjectOption && assert( this.supertype,
        'supertype expected if no toStateObject option is provided' );
      stateObject = this.toStateObjectOption ? this.toStateObjectOption( coreObject ) : this.supertype!.toStateObject( coreObject );
    }

    // Do not validate the api state, which get's pruned based on provided apiStateKeys, only validate the complete state
    if ( assert && !GETTING_STATE_FOR_API &&

         // only if this IOType instance has more to validate than the supertype
         ( this.toStateObjectSupplied || this.stateSchemaSupplied ) ) {

      // Only validate the stateObject if it is phetioState:true.
      // This is an n*m algorithm because for each time toStateObject is called and needs validation, this.validateStateObject
      // looks all the way up the IOType hierarchy. This is not efficient, but gains us the ability to make sure that
      // the stateObject doesn't have any superfluous, unexpected keys. The "m" portion is based on how many sub-properties
      // in a state call `toStateObject`, and the "n" portion is based on how many IOTypes in the hierarchy define a
      // toStateObject or stateSchema. In the future we could potentially improve performance by having validateStateObject
      // only check against the schema at this level, but then extra keys in the stateObject would not be caught. From work done in https://github.com/phetsims/phet-io/issues/1774
      this.validateStateObject( stateObject );
    }

    let resolvedStateObject: StateType;

    // When getting API state, prune out any state that don't opt in as desired for API tracking, see apiStateKeys
    if ( GETTING_STATE_FOR_API && this.isCompositeStateSchema() &&

         // When running a nested toStateObject call while generating api state, values should be opt in, because the
         // element state has asked for these values. For example PropertyIO<RangeIO> wants to see min/max state in
         // its validValues.
         !( API_STATE_NESTED_COUNT > 1 && this.apiStateKeysProvided() )
    ) {
      resolvedStateObject = _.pick( stateObject, this.getAllAPIStateKeys() ) as StateType;
    }
    else {
      resolvedStateObject = stateObject;
    }
    API_STATE_NESTED_COUNT--;
    return resolvedStateObject;
  }

  public fromStateObject( stateObject: StateType ): T {
    if ( this.fromStateObjectOption ) {
      return this.fromStateObjectOption( stateObject );
    }
    assert && assert( this.supertype );
    return this.supertype!.fromStateObject( stateObject );
  }

  public applyState( coreObject: T, stateObject: StateType ): void {
    validate( coreObject, this.validator, VALIDATE_OPTIONS_FALSE );

    // Validate, but only if this IOType instance has more to validate than the supertype
    if ( this.applyStateSupplied || this.stateSchemaSupplied ) {

      // Validate that the provided stateObject is of the expected schema
      // NOTE: Cannot use this.validateStateObject because options adopts supertype.applyState, which is bounds to the
      // parent IOType. This prevents correct validation because the supertype doesn't know about the subtype schemas.
      // @ts-expect-error we cannot type check against PhetioObject from this file
      assert && coreObject.phetioType && coreObject.phetioType.validateStateObject( stateObject );
    }

    // Only do this non-standard applyState function from stateSchema if there is a stateSchema but no applyState provided
    if ( !this.applyStateSupplied && this.stateSchemaSupplied && this.stateSchema && this.stateSchema.isComposite() ) {
      this.defaultApplyState( coreObject, stateObject as CompositeStateObjectType );
    }
    else {
      assert && !this.applyStateOption && assert( this.supertype,
        'supertype expected if no applyState option is provided' );
      this.applyStateOption ? this.applyStateOption( coreObject, stateObject ) : this.supertype!.applyState( coreObject, stateObject );
    }
  }

  public stateObjectToCreateElementArguments( stateObject: StateType ): unknown[] {
    if ( this.stateObjectToCreateElementArgumentsOption ) {
      return this.stateObjectToCreateElementArgumentsOption( stateObject );
    }
    assert && assert( this.supertype );
    return this.supertype!.stateObjectToCreateElementArguments( stateObject );
  }


  // Include state from all composite state schemas up and down the type hierarchy (children overriding parents).
  private defaultToStateObject( coreObject: T ): StateType {

    let superStateObject: Partial<StateType> = {};
    if ( this.supertype ) {
      superStateObject = this.supertype.defaultToStateObject( coreObject );
    }

    if ( this.stateSchema && this.stateSchema.isComposite() ) {
      return _.merge( superStateObject, this.stateSchema.defaultToStateObject( coreObject ) ) as StateType;
    }
    else {
      return superStateObject as StateType;
    }
  }

  // Include state from all composite state schemas up and down the type hierarchy (children overriding parents).
  private defaultApplyState( coreObject: T, stateObject: CompositeStateObjectType ): void {

    if ( this.supertype ) {
      this.supertype.defaultApplyState( coreObject, stateObject );
    }

    if ( this.stateSchema && this.stateSchema.isComposite() ) {
      this.stateSchema.defaultApplyState( coreObject, stateObject );
    }
  }

  /**
   * Gets an array of IOTypes of the self type and all the supertype ancestors.
   */
  private getTypeHierarchy(): AnyIOType[] {
    const array = [];

    let ioType: AnyIOType = this; // eslint-disable-line consistent-this, @typescript-eslint/no-this-alias
    while ( ioType ) {
      array.push( ioType );
      ioType = ioType.supertype!;
    }
    return array;
  }

  /**
   * Returns true if this IOType is a subtype of the passed-in type (or if they are the same).
   */
  public extends( type: IOType<unknown, unknown> ): boolean {

    // memory-based implementation OK since this method is only used in assertions
    return this.getTypeHierarchy().includes( type );
  }

  /**
   * Return all the metadata defaults (for the entire IOType hierarchy)
   */
  public getAllMetadataDefaults(): Partial<PhetioElementMetadata> {
    return _.merge( {}, this.supertype ? this.supertype.getAllMetadataDefaults() : {}, this.metadataDefaults );
  }

  /**
   * Return all the data defaults (for the entire IOType hierarchy)
   */
  public getAllDataDefaults(): Record<string, unknown> {
    return _.merge( {}, this.supertype ? this.supertype.getAllDataDefaults() : {}, this.dataDefaults );
  }

  /**
   * This cannot be in stateSchema, because some IOTypes do not have stateSchema instances, but their supertype does.
   */
  private isCompositeStateSchema(): boolean {
    return this.supertype?.isCompositeStateSchema() || !!this.stateSchema?.compositeSchema;
  }

  /**
   * Return all the apiStateKey option values (for the entire IOType hierarchy)
   * For example:
   *  [ null, null, ['validValues'], null ] if there were three supertypes, and your parent was the only IOType with apiStateKeys
   */
  private getAllAPIStateKeyValues( apiStateKeysPerLevel: ( APIStateKeys | null )[] = [] ): ( APIStateKeys | null )[] {
    this.supertype && this.supertype.getAllAPIStateKeyValues( apiStateKeysPerLevel );
    apiStateKeysPerLevel.push( this.stateSchema?.apiStateKeys || null );
    return apiStateKeysPerLevel;
  }

  /**
   * See if any IOType up the hierarchy actually supplied apiStateKeys, even in `[]`, meaning "don't opt-in to nested
   * API state.
   */
  private apiStateKeysProvided(): boolean {
    return this.getAllAPIStateKeyValues().filter( truthy ).length === 0;
  }

  /**
   * Return all the apiStateKeys (for the entire IOType hierarchy) in one array.
   */
  public getAllAPIStateKeys(): APIStateKeys {
    return _.concat( ...this.getAllAPIStateKeyValues().map( x => x || [] ) );
  }

  /**
   * Get the state object for a PhET-iO Element, but only the entries that should be tracked by the PhET-iO API. See
   * StateSchema.apiStateKeys for details. This implementation sets a global to make sure that nested state also only
   * selects the apiStateKeys for api tracking (PropertyIO<RangeIO> could have validValues of PointIO that shouldn't
   * include non-tracked values of PointIO, if there are any).
   */
  public toStateObjectForAPI( coreObject: T ): StateType {
    assert && assert( !GETTING_STATE_FOR_API, 'API state cannot nest due to limitation of the global' );
    GETTING_STATE_FOR_API = true;
    assert && assert( API_STATE_NESTED_COUNT === 0, 'not nested before getting API state' );
    const stateObjectForAPIOnly = this.toStateObject( coreObject );
    assert && assert( API_STATE_NESTED_COUNT === 0, 'not nested after getting API state' );
    GETTING_STATE_FOR_API = false;
    return stateObjectForAPIOnly;
  }

  /**
   * @param stateObject - the stateObject to validate against
   * @param toAssert=false - whether to assert when invalid
   * @param schemaKeysPresentInStateObject=[]
   * @returns if the stateObject is valid or not.
   */
  public isStateObjectValid( stateObject: StateType, toAssert = false, schemaKeysPresentInStateObject: string[] = [] ): boolean {

    // Set to false when invalid
    let valid = true;

    // make sure the stateObject has everything the schema requires and nothing more
    if ( this.stateSchema ) {
      const validSoFar = this.stateSchema.checkStateObjectValid( stateObject as SelfStateType, toAssert, schemaKeysPresentInStateObject );

      // null as a marker to keep checking up the hierarchy, otherwise we reached our based case because the stateSchema was a value, not a composite
      if ( validSoFar !== null ) {
        return validSoFar;
      }
    }

    if ( this.supertype ) {
      return valid && this.supertype.isStateObjectValid( stateObject, toAssert, schemaKeysPresentInStateObject );
    }

    // When we reach the root, make sure there isn't anything in the stateObject that isn't described by a schema
    if ( !this.supertype && stateObject && typeof stateObject !== 'string' && !Array.isArray( stateObject ) ) {

      // Visit the state
      Object.keys( stateObject ).forEach( key => {
        const keyValid = schemaKeysPresentInStateObject.includes( key );
        if ( !keyValid ) {
          valid = false;
        }
        assert && toAssert && assert( keyValid, `stateObject provided a key that is not in the schema: ${key}` );
      } );

      return valid;
    }
    return true;
  }

  /**
   * Assert if the provided stateObject is not valid to this IOType's stateSchema
   */
  public validateStateObject( stateObject: StateType ): void {
    this.isStateObjectValid( stateObject, true );
  }

  public toString(): IOTypeName {
    return this.typeName;
  }

  /**
   * Return an object that indicates the API type, including documentation, methods & signatures, supertypes, etc.
   * The object is intended for serialization via JSON.stringify().
   *
   * This function could be static, but that doesn't work well with the singleton pattern, so keep in on the prototype.
   */
  public getAPI(): PhetioType {

    // Enumerate the methods specific to the type (not for supertype).
    const methods: Methods = {};
    const methodNames = _.keys( this.methods );

    // iterate over each method
    for ( let i = 0; i < methodNames.length; i++ ) {
      const methodName = methodNames[ i ];
      const method = this.methods![ methodName ];

      const m: Method = {

        // Return names for parameter types and return types to prevent loops in type graph
        returnType: method.returnType.typeName,
        parameterTypes: method.parameterTypes.map( mapAPIForType ),
        documentation: method.documentation
      };

      // invocableForReadOnlyElements===false is opt-in
      if ( method.invocableForReadOnlyElements === false ) {
        m.invocableForReadOnlyElements = false;
      }
      methods[ methodName ] = m;
    }

    const supertype = this.supertype;

    // Return all parts of the API as an object
    const phetioType: PhetioType = {
      methods: methods,
      supertype: supertype ? supertype.typeName : supertype,
      typeName: this.typeName,
      documentation: this.documentation,
      events: this.events,
      metadataDefaults: this.metadataDefaults,
      dataDefaults: this.dataDefaults,
      methodOrder: this.methodOrder
    };

    if ( this.stateSchema ) {
      phetioType.stateSchema = this.stateSchema.getStateSchemaAPI();

      if ( this.stateSchema.apiStateKeys && this.stateSchema.apiStateKeys.length > 0 ) {
        phetioType.apiStateKeys = this.stateSchema.apiStateKeys;
      }
    }

    // This way we don't have this key unless there are parameterTypes possible (empty array allowed)
    if ( this.parameterTypes ) {
      phetioType.parameterTypes = this.parameterTypes.map( mapAPIForType );
    }

    return phetioType;
  }
}

const mapAPIForType = ( parameterType: AnyIOType ): string => parameterType.typeName;

// default state value
const DEFAULT_STATE = null;

// This must be declared after the class declaration to avoid a circular dependency with PhetioObject.
// @readonly
IOType.ObjectIO = new IOType<PhetioObject, null>( TandemConstants.OBJECT_IO_TYPE_NAME, {
  isValidValue: () => true,
  supertype: null,
  documentation: 'The root of the PhET-iO Type hierarchy',
  toStateObject: ( coreObject: PhetioObject ) => {

    if ( phet && phet.tandem && phet.tandem.Tandem.VALIDATION ) {

      assert && assert( coreObject.tandem, 'coreObject must be PhET-iO object' );

      assert && assert( !coreObject.phetioState,
        `fell back to root serialization state for ${coreObject.tandem.phetioID}. Potential solutions:
         * mark the type as phetioState: false
         * create a custom toStateObject method in your IOType
         * perhaps you have everything right, but forgot to pass in the IOType via phetioType in the constructor` );
    }
    return DEFAULT_STATE;
  },
  fromStateObject: () => {
    throw new Error( 'ObjectIO.fromStateObject should not be called' );
  },
  stateObjectToCreateElementArguments: () => [],
  applyState: _.noop,
  metadataDefaults: TandemConstants.PHET_IO_OBJECT_METADATA_DEFAULTS,
  dataDefaults: {
    initialState: DEFAULT_STATE
  },
  stateSchema: null
} );

tandemNamespace.register( 'IOType', IOType );