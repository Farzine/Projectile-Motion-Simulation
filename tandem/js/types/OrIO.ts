// Copyright 2020-2025, University of Colorado Boulder

/**
 * Parametric IOType that adds support for serializing an element as multiple types, as a composite. Serialization occurs
 * via a first-come-first-serialize basis, where the first parameterType will be the
 *
 * Sample usage:
 *
 * window.numberOrStringProperty = new Property( 'I am currently a string', {
 tandem: Tandem.GENERAL_MODEL.createTandem( 'numberOrStringProperty' ),
 phetioValueType: OrIO( [ StringIO, NumberIO ] )
 } );
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import Validation from '../../../axon/js/Validation.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import IOTypeCache from '../IOTypeCache.js';
import tandemNamespace from '../tandemNamespace.js';
import IOType, { AnyIOType } from './IOType.js';
import StateSchema from './StateSchema.js';

// cache each parameterized IOType so that it is only created once
const cache = new IOTypeCache<IOType<IntentionalAny, OrIOState>, string>();

// TODO: Make this parametric, https://github.com/phetsims/tandem/issues/261
type OrIOState = {
  index: number;
  state: IntentionalAny;
};

/**
 * Parametric type constructor function, do not use `new`
 * @param parameterTypes - a list of IOType to combine into a single composite
 */
const OrIO = ( parameterTypes: AnyIOType[] ): IOType<IntentionalAny, OrIOState> => {
  assert && assert( Array.isArray( parameterTypes ), 'OrIO needs to be an array' );
  assert && assert( parameterTypes.length > 1, 'OrIO needs parameterTypes' );
  const typeNames = parameterTypes.map( parameterType => parameterType.typeName );
  const key = typeNames.join( ',' );

  if ( !cache.has( key ) ) {
    const isValidValue = ( instance: IntentionalAny ) => {
      for ( let i = 0; i < parameterTypes.length; i++ ) {
        const parameterType = parameterTypes[ i ];
        if ( Validation.isValueValid( instance, parameterType.validator ) ) {
          return true;
        }
      }
      return false;
    };
    cache.set( key, new IOType<IntentionalAny, OrIOState>( `OrIO<${typeNames.join( ', ' )}>`, {
      documentation: 'A PhET-iO Type adding support for a composite type that can be any of its parameters.',
      parameterTypes: parameterTypes,
      isValidValue: isValidValue,

      toStateObject: instance => {
        for ( let i = 0; i < parameterTypes.length; i++ ) {
          const parameterType = parameterTypes[ i ];
          if ( Validation.isValueValid( instance, parameterType.validator ) ) {
            return {
              index: i,
              state: parameterType.toStateObject( instance )
            };
          }
        }
        throw new Error( 'somehow the instance was not valid, we should not get here. Why was isValidValue not used before this step?' );
      },

      fromStateObject: ( stateObject: IntentionalAny ) => {
        assert && assert( stateObject.hasOwnProperty( 'index' ), 'index required for deserialization' );
        assert && assert( stateObject.hasOwnProperty( 'state' ), 'state required for deserialization' );
        return parameterTypes[ stateObject.index ].fromStateObject( stateObject.state );
      },
      stateSchema: StateSchema.asValue( `${typeNames.join( '|' )}`, {
        isValidValue: stateObject => {

          // Check based on the parameter that serialized the state
          if ( typeof stateObject.index === 'number' ) {
            return parameterTypes[ stateObject.index ].isStateObjectValid( stateObject.state );
          }
          return false;
        }
      } )
    } ) );
  }

  return cache.get( key )!;
};

tandemNamespace.register( 'OrIO', OrIO );
export default OrIO;