// Copyright 2018-2025, University of Colorado Boulder

/**
 * Parametric IOType that adds support for null values in toStateObject/fromStateObject. This type is to
 * prevent the propagation of null handling, mainly in to/fromStateObject, in each type. This also makes null
 * explicit for phet-io.
 *
 * Sample usage:
 *
 *  this.ageProperty = new Property( null, {
 *    tandem: tandem.createTandem( 'ageProperty' ),
 *    phetioValueType: NullableIO( NumberIO ) // signifies that the Property can be Number or null
 * } );
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 * @author Sam Reid (PhET Interactive Simulations)
 */

import Validation from '../../../axon/js/Validation.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import IOTypeCache from '../IOTypeCache.js';
import tandemNamespace from '../tandemNamespace.js';
import IOType, { AnyIOType } from './IOType.js';
import StateSchema from './StateSchema.js';

// Cache each parameterized IOType so that it is only created once
const cache = new IOTypeCache<AnyIOType, IOType<IntentionalAny | null, IntentionalAny | null>>();

const NullableIO = <ParameterType, ParameterStateType extends PatternStateSelfType, PatternStateSelfType>(
  parameterType: IOType<ParameterType, ParameterStateType, PatternStateSelfType>
): IOType<ParameterType | null, ParameterStateType | null> => {

  assert && assert( parameterType, 'NullableIO needs parameterType' );

  if ( !cache.has( parameterType ) ) {
    cache.set( parameterType, new IOType<ParameterType | null, ParameterStateType | null>( `NullableIO<${parameterType.typeName}>`, {
      documentation: 'A PhET-iO Type adding support for null in addition to the behavior of its parameter.',
      isValidValue: instance => instance === null || Validation.isValueValid( instance, parameterType.validator ),
      parameterTypes: [ parameterType ],

      // If the argument is null, returns null. Otherwise, converts the instance to a state object for serialization.
      toStateObject: instance => instance === null ? null : parameterType.toStateObject( instance ),

      // If the argument is null, returns null. Otherwise, converts a state object to an instance of the underlying type.
      fromStateObject: stateObject => stateObject === null ? null : parameterType.fromStateObject( stateObject ),
      stateSchema: StateSchema.asValue( `null|<${parameterType.typeName}>`, {
          isValidValue: value => value === null || parameterType.isStateObjectValid( value )
        }
      )
    } ) );
  }

  return cache.get( parameterType )!;
};

tandemNamespace.register( 'NullableIO', NullableIO );
export default NullableIO;