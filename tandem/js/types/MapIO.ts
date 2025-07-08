// Copyright 2021-2025, University of Colorado Boulder

/**
 * PhET-iO Type for JS's built-in Map type.
 *
 * NOTE: This has not been reviewed, tested or used in production code yet.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Jesse Greenberg (PhET Interactive Simulations)
 */

import Validation from '../../../axon/js/Validation.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import IOTypeCache from '../IOTypeCache.js';
import tandemNamespace from '../tandemNamespace.js';
import IOType, { AnyIOType } from './IOType.js';
import StateSchema from './StateSchema.js';

// Cache each parameterized IOType so that it is only created once.
const cache = new IOTypeCache<AnyIOType, string>();

const ARRAY_OF_ARRAY_VALIDATOR = {
  valueType: Array,
  isValidValue: ( value: IntentionalAny ) => Array.isArray( value ) && value.every( element => Array.isArray( element ) )
};

export type MapStateObject<KState, VState> = Array<[ KState, VState ]>;

/**
 * Parametric IOType constructor.  Given an element type, this function returns an appropriate map IOType.
 * This caching implementation should be kept in sync with the other parametric IOType caching implementations.
 */
function MapIO<KType, KStateType, VType, VStateType>(
  keyType: IOType<KType, KStateType>,
  valueType: IOType<VType, VStateType>
): IOType<Map<KType, VType>, [ KStateType, VStateType ]> {

  const cacheKey = keyType.typeName + ',' + valueType.typeName;
  if ( !cache.has( cacheKey ) ) {

    cache.set( cacheKey, new IOType<Map<KType, VType>, [ KStateType, VStateType ][]>( `MapIO<${keyType.typeName},${valueType.typeName}>`, {
      valueType: Map,
      isValidValue: map => {
        for ( const [ key, value ] of map ) {
          if ( !Validation.isValueValid( key, keyType.validator ) ) {
            return false;
          }
          if ( !Validation.isValueValid( value, valueType.validator ) ) {
            return false;
          }
        }
        return true;
      },
      parameterTypes: [ keyType, valueType ],
      toStateObject: map => {
        const array: MapStateObject<KStateType, VStateType> = [];
        for ( const [ key, value ] of map ) {
          array.push( [ keyType.toStateObject( key ), valueType.toStateObject( value ) ] );
        }
        return array;
      },
      fromStateObject: outerArray => {
        const result = outerArray.map( tuple => {
          return [ keyType.fromStateObject( tuple[ 0 ] ), valueType.fromStateObject( tuple[ 1 ] ) ];
        } );

        // @ts-expect-error not sure how to demonstrate that the argument is readonly, since it is dynamically created
        return new Map( result );
      },
      documentation: 'PhET-iO Type for the built-in JS Map type, with the key and value types specified.',
      stateSchema: StateSchema.asValue( `Map<${keyType.typeName},${valueType.typeName}>`, {
        isValidValue: stateObject => {
          if ( !Validation.isValueValid( stateObject, ARRAY_OF_ARRAY_VALIDATOR ) ) {
            return false;
          }
          for ( let i = 0; i < stateObject.length; i++ ) {
            const mapElementArray = stateObject[ i ];
            if ( !Array.isArray( mapElementArray ) ) {
              return false;
            }
            if ( mapElementArray.length !== 2 ) {
              return false;
            }
            // TODO: check each entry based on the key and value IOType stateSchema, https://github.com/phetsims/tandem/issues/271
          }
          return true;
        }
      } )
    } ) );
  }

  return cache.get( cacheKey )!;
}

tandemNamespace.register( 'MapIO', MapIO );
export default MapIO;