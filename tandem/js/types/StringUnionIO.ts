// Copyright 2022-2025, University of Colorado Boulder

/**
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 * @author Sam Reid (PhET Interactive Simulations)
 */

import IOTypeCache from '../IOTypeCache.js';
import tandemNamespace from '../tandemNamespace.js';
import IOType, { AnyIOType } from './IOType.js';
import StateSchema from './StateSchema.js';

// Cache each parameterized IOType so that it is only created once
const cache = new IOTypeCache<AnyIOType, readonly string[]>();

const StringUnionIO = <ParameterType extends readonly string[]>( unionValues: ParameterType ): IOType<ParameterType, string> => {

  assert && assert( unionValues, 'StringUnionIO needs unionValues' );

  if ( !cache.has( unionValues ) ) {
    const typeName = unionValues.join( ',' );
    cache.set( unionValues, new IOType<string, string>( `StringUnionIO<${typeName}>`, {
      documentation: 'A PhET-iO Type validating on specific string values.',
      isValidValue: instance => unionValues.includes( instance ),

      // serializing strings here
      toStateObject: _.identity,
      fromStateObject: _.identity,

      // TODO: This is the only place that has IO suffix in StateSchema.asValue, see https://github.com/phetsims/tandem/issues/306
      stateSchema: StateSchema.asValue( `StringUnionIO<${typeName}>`, {
          isValidValue: value => unionValues.includes( value )
        }
      )
    } ) );
  }

  return cache.get( unionValues )!;
};

tandemNamespace.register( 'StringUnionIO', StringUnionIO );
export default StringUnionIO;