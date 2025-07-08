// Copyright 2021-2025, University of Colorado Boulder

/**
 * Class responsible for storing information about the schema of PhET-iO state. See IOType stateSchema option for usage
 * and more information.
 *
 * There are two types of StateSchema:
 * - The first is a stateSchema "value". This is when the state of an IOType is itself a value in the state. In
 * effect, this just serves as boilerplate, and isn't the primary usage of stateSchema. For example, a StringIO or
 * NumberIO.
 * - The second is a "composite", where the state of an IOType is made from subcomponents, each of which have an IOType.
 * A composite schema was named because it is a sum of its parts. For example a BunnyIO has multiple components that
 * make it up (mother/father/age/etc). Check which type of StateSchema your instance is with StateSchema.isComposite().
 *
 * When stored in the API, StateSchema values are stored as strings, see StateSchema.asValue, and composite state schemas
 * are stored as objects with values that are each IOType names.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import Validation, { Validator } from '../../../axon/js/Validation.js';
import assertMutuallyExclusiveOptions from '../../../phet-core/js/assertMutuallyExclusiveOptions.js';
import optionize from '../../../phet-core/js/optionize.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import { IOTypeName } from '../phet-io-types.js';
import tandemNamespace from '../tandemNamespace.js';
import { type AnyIOType } from './IOType.js';

/**
 * This is the primary functionality of the StateSchema class. An IOType can be provided a composite schema like so:
 * {
 *   subcomponent1: StringIO;
 *   subcomponent2: NumberIO;
 * }
 * By providing this, you are giving the schema to allow StateSchema to serialize and deserialize itself based on the
 * composite schema.
 */
export type CompositeSchema<SelfStateType> = {
  // [K in keyof SelfStateType]: IOType | { myIOType: IOType; isAPIStateful: true };
  [K in keyof SelfStateType]: AnyIOType
};

export type APIStateKeys = string[];

// As provided in the PhET-iO API json.
type CompositeSchemaAPI = Record<string, IOTypeName>;

// The schema of the stateObject value
export type CompositeStateObjectType = Record<string, IntentionalAny>;

// Pluck the result toStateObject types from the CompositeSchema. For instance, map a state schema like so:
// {name: StringIO} => {name: string}
export type StateObject<T extends Record<string, AnyIOType>> = {
  [key in keyof T]: ReturnType<T[key]['toStateObject']>;
};

type StateSchemaOptions<SelfStateType> = {

  // What the IOType will display as in the API.
  displayString?: string;

  // Provided to validate the contents of the stateObject. Not the instance it came from
  validator?: Validator<IntentionalAny> | null;

  // The primary way to provide the detailed schema about the state for this instance. Composite schemas are a sum of
  // their stateful parts, instead of a "value" themselves.
  // An object literal of keys that correspond to an IOType
  compositeSchema?: null | CompositeSchema<SelfStateType>;

  // A list of keys found in this IOType's composite state that should be API tracked. See IOType options.apiStateKeys
  // for more info.
  apiStateKeys?: APIStateKeys | null;
};

export default class StateSchema<T, SelfStateType> {
  private readonly displayString: string;
  private readonly validator: Validator<SelfStateType> | null;

  // "composite" state schemas are treated differently that value state schemas
  public readonly compositeSchema: null | CompositeSchema<SelfStateType>;
  public readonly apiStateKeys: APIStateKeys | null;

  public constructor( providedOptions?: StateSchemaOptions<SelfStateType> ) {

    // Either create with compositeSchema, or specify a that this state is just a value
    assert && assertMutuallyExclusiveOptions( providedOptions,
      [ 'compositeSchema', 'apiStateKeys' ],
      [ 'displayString', 'validator' ]
    );

    const options = optionize<StateSchemaOptions<SelfStateType>>()( {
      displayString: '',
      validator: null,
      compositeSchema: null,
      apiStateKeys: null
    }, providedOptions );

    this.displayString = options.displayString;
    this.validator = options.validator;

    this.compositeSchema = options.compositeSchema;
    this.apiStateKeys = options.apiStateKeys;

    if ( assert && options.apiStateKeys ) {
      assert && assert( options.compositeSchema, 'apiStateKeys can only be specified by a composite state schema.' );
      assert && options.apiStateKeys.forEach( apiStateKey => {
        assert && assert( options.compositeSchema!.hasOwnProperty( apiStateKey ),
          `apiStateKey not part of composite state schema: ${apiStateKey}` );
      } );
    }
  }

  /**
   * This method provides a default implementation for setting a stateObject onto an object from the stateSchema information.
   * It supports the coreObject keys as private, underscore-prefixed field, as
   * well as if the coreObject has an es5 setter instead of an actual field.
   */
  public defaultApplyState( coreObject: T, stateObject: CompositeStateObjectType ): void {

    assert && assert( this.isComposite(), 'defaultApplyState from stateSchema only applies to composite stateSchemas' );
    for ( const stateKey in this.compositeSchema ) {
      if ( this.compositeSchema.hasOwnProperty( stateKey ) ) {
        assert && assert( stateObject.hasOwnProperty( stateKey ), `stateObject does not have expected schema key: ${stateKey}` );

        // The IOType for the key in the composite.
        const schemaIOType = this.compositeSchema[ stateKey ];

        const coreObjectAccessorName = this.getCoreObjectAccessorName( stateKey, coreObject );

        // Using fromStateObject to deserialize sub-component
        if ( schemaIOType.defaultDeserializationMethod === 'fromStateObject' ) {

          // @ts-expect-error, I don't know how to tell typescript that we are accessing an expected key on the PhetioObject subtype. Likely there is no way with making things generic.
          coreObject[ coreObjectAccessorName ] = this.compositeSchema[ stateKey ].fromStateObject( stateObject[ stateKey ] );
        }
        else {
          assert && assert( schemaIOType.defaultDeserializationMethod === 'applyState', 'unexpected deserialization method' );

          // Using applyState to deserialize sub-component
          // @ts-expect-error, I don't know how to tell typescript that we are accessing an expected key on the PhetioObject subtype. Likely there is no way with making things generic.
          this.compositeSchema[ stateKey ].applyState( coreObject[ coreObjectAccessorName ], stateObject[ stateKey ] );
        }
      }
    }
  }

  /**
   * This method provides a default implementation for creating a stateObject from the stateSchema by accessing those
   * same key names on the coreObject instance. It supports those keys as private, underscore-prefixed field, as
   * well as if the coreObject has an es5 getter instead of an actual field.
   */
  public defaultToStateObject( coreObject: T ): SelfStateType {
    assert && assert( this.isComposite(), 'defaultToStateObject from stateSchema only applies to composite stateSchemas' );

    const stateObject = {};
    for ( const stateKey in this.compositeSchema ) {
      if ( this.compositeSchema.hasOwnProperty( stateKey ) ) {

        const coreObjectAccessorName = this.getCoreObjectAccessorName( stateKey, coreObject );

        if ( assert ) {
          const descriptor = Object.getOwnPropertyDescriptor( coreObject, coreObjectAccessorName )!;

          let isGetter = false;

          // @ts-expect-error Subtype T for this method better
          if ( coreObject.constructor.prototype ) {

            // The prototype is what has the getter on it
            // @ts-expect-error Subtype T for this method better
            const prototypeDescriptor = Object.getOwnPropertyDescriptor( coreObject.constructor!.prototype, coreObjectAccessorName );
            isGetter = !!prototypeDescriptor && !!prototypeDescriptor.get;
          }

          const isValue = !!descriptor && descriptor.hasOwnProperty( 'value' ) && descriptor.writable;
          assert && assert( isValue || isGetter,
            `cannot get state because coreObject does not have expected schema key: ${coreObjectAccessorName}` );

        }

        // @ts-expect-error https://github.com/phetsims/tandem/issues/261
        stateObject[ stateKey ] = this.compositeSchema[ stateKey ].toStateObject( coreObject[ coreObjectAccessorName ] );
      }
    }
    return stateObject as SelfStateType;
  }

  /**
   * Provide the member string key that should be used to get/set an instance's field. Used only internally for the
   * default implementations of toStateObject and applyState.
   */
  private getCoreObjectAccessorName( stateKey: string, coreObject: T ): string {

    assert && assert( !stateKey.startsWith( '__' ), 'State keys should not start with too many underscores: ' + stateKey + '. When serializing ', coreObject );

    // Does the class field start with an underscore? We need to cover two cases here. The first is where the underscore
    // was added to make a private state key. The second, is where the core class only has the underscore-prefixed
    // field key name available for setting. The easiest algorithm to cover all cases is to see if the coreObject has
    // the underscore-prefixed key name, and use that if available, otherwise use the stateKey without an underscore.
    const noUnderscore = stateKey.startsWith( '_' ) ? stateKey.substring( 1 ) : stateKey;
    const underscored = `_${noUnderscore}`;
    let coreObjectAccessorName: string;

    // @ts-expect-error - T is not specific to composite schemas, so NumberIO doesn't actually need a hasOwnProperty method
    if ( coreObject.hasOwnProperty( underscored ) ) {
      coreObjectAccessorName = underscored;
    }
    else {
      coreObjectAccessorName = noUnderscore;
    }
    return coreObjectAccessorName;
  }

  /**
   * True if the StateSchema is a composite schema. See the header documentation in this file for the definition
   * of "composite" schema.
   */
  public isComposite(): boolean {
    return !!this.compositeSchema;
  }

  /**
   * Check if a given stateObject is as valid as can be determined by this StateSchema. Will return null if valid, but
   * needs more checking up and down the hierarchy.
   *
   * @param stateObject - the stateObject to validate against
   * @param toAssert - whether to assert when invalid
   * @param schemaKeysPresentInStateObject - to be populated with any keys this StateSchema is responsible for.
   * @returns boolean if validity can be checked, null if valid, but next in the hierarchy is needed
   */
  public checkStateObjectValid( stateObject: SelfStateType, toAssert: boolean, schemaKeysPresentInStateObject: string[] ): boolean | null {
    if ( this.isComposite() ) {
      const compositeStateObject = stateObject as CompositeStateObjectType;
      const schema = this.compositeSchema!;

      let valid = null;
      if ( !compositeStateObject ) {
        assert && toAssert && assert( false, 'There was no stateObject, but there was a state schema saying there should be', schema );
        valid = false;
        return valid;
      }
      const keys = Object.keys( schema ) as ( keyof CompositeSchema<SelfStateType> )[];
      keys.forEach( key => {

        if ( typeof key === 'string' ) {

          if ( !compositeStateObject.hasOwnProperty( key ) ) {
            assert && toAssert && assert( false, `${key} in state schema but not in the state object` );
            valid = false;
          }
          else {
            if ( !schema[ key ].isStateObjectValid( compositeStateObject[ key ], false ) ) {
              assert && toAssert && assert( false, `stateObject is not valid for ${key}. stateObject=`, compositeStateObject[ key ], 'schema=', schema[ key ] );
              valid = false;
            }
          }
          schemaKeysPresentInStateObject.push( key );
        }
        else {
          console.error( 'key should be a string', key );
          assert && assert( false, 'key should be a string' );
        }
      } );
      return valid;
    }
    else {
      assert && assert( this.validator, 'validator must be present if not composite' );
      const valueStateObject = stateObject;

      if ( assert && toAssert ) {
        const validationError = Validation.getValidationError( valueStateObject, this.validator! );
        assert( validationError === null, 'valueStateObject failed validation', valueStateObject, validationError );
      }

      return Validation.isValueValid( valueStateObject, this.validator! );
    }
  }

  /**
   * Get a list of all IOTypes associated with this StateSchema
   */
  public getRelatedTypes(): AnyIOType[] {
    const relatedTypes: AnyIOType[] = [];

    if ( this.compositeSchema ) {

      const keys = Object.keys( this.compositeSchema ) as ( keyof CompositeSchema<SelfStateType> )[];
      keys.forEach( stateSchemaKey => {
        relatedTypes.push( this.compositeSchema![ stateSchemaKey ] );
      } );
    }
    return relatedTypes;
  }


  /**
   * Returns a unique identified for this stateSchema, or an object of the stateSchemas for each sub-component in the composite
   * (phet-io internal)
   */
  public getStateSchemaAPI(): string | CompositeSchemaAPI {
    if ( this.isComposite() ) {
      return _.mapValues( this.compositeSchema, value => value.typeName );
    }
    else {
      return this.displayString;
    }
  }


  /**
   * Factory function for StateSchema instances that represent a single value of state. This is opposed to a composite
   * schema of sub-components.
   */
  public static asValue<T, StateType>( displayString: string, validator: Validator<IntentionalAny> ): StateSchema<T, StateType> {
    assert && assert( validator, 'validator required' );
    return new StateSchema<T, StateType>( {
      validator: validator,
      displayString: displayString
    } );
  }
}

tandemNamespace.register( 'StateSchema', StateSchema );