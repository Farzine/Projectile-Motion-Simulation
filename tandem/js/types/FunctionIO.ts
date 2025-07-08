// Copyright 2018-2025, University of Colorado Boulder

/**
 * PhET-iO Type for JS's built-in function type.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Andrew Adare (PhET Interactive Simulations)
 */

import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import IOTypeCache from '../IOTypeCache.js';
import tandemNamespace from '../tandemNamespace.js';
import IOType, { AnyIOType } from './IOType.js';


// cache each parameterized IOType so that it is only created once
const cache = new IOTypeCache<AnyIOType, string>();

/**
 * Parametric IOType constructor--given return type and parameter types, this function returns a type wrapped IOType for
 * that "class" of functions. "Class" here refers to the supported parameter and return IOTypes.
 * This caching implementation should be kept in sync with the other parametric IOType caching implementations.
 * @param returnType - IOType of the return type of the function that can support cross-frame serialization
 * @param functionParameterTypes - IOTypes for the individual arguments of the function.
 */
const FunctionIO = ( returnType: AnyIOType, functionParameterTypes: AnyIOType[] ): AnyIOType => {
  for ( let i = 0; i < functionParameterTypes.length; i++ ) {
    assert && assert( functionParameterTypes[ i ], 'parameter type was not truthy' );
  }
  assert && assert( returnType, 'return type was not truthy' );

  // REVIEW https://github.com/phetsims/tandem/issues/169 Why is this different than the typeName later in this file?
  const cacheKey = `${returnType.typeName}.${functionParameterTypes.map( type => type.typeName ).join( ',' )}`;

  if ( !cache.has( cacheKey ) ) {

    // gather a list of argument names for the documentation string
    let argsString = functionParameterTypes.map( parameterType => parameterType.typeName ).join( ', ' );
    if ( argsString === '' ) {
      argsString = 'none';
    }
    const parameterTypesString = functionParameterTypes.map( parameterType => parameterType.typeName ).join( ',' );

    cache.set( cacheKey, new IOType<IntentionalAny, IntentionalAny>( `FunctionIO(${parameterTypesString})=>${returnType.typeName}`, {
      valueType: 'function',
      isFunctionType: true,

      // These are the parameters to this FunctionIO, not to the function it wraps. That is why it includes the return type.
      // NOTE: the order is very important, for instance phetioCommandProcessor relies on the parameters being before
      // the return type.  If we decide this is too brittle, perhaps we should subclass IOType to FunctionIOType, and it
      // can track its functionParameterTypes separately from the returnType.
      parameterTypes: functionParameterTypes.concat( [ returnType ] ),
      documentation: `${'Wrapper for the built-in JS function type.<br>' +
                     '<strong>Arguments:</strong> '}${argsString}<br>` +
                     `<strong>Return Type:</strong> ${returnType.typeName}`
    } ) );
  }

  return cache.get( cacheKey )!;
};

tandemNamespace.register( 'FunctionIO', FunctionIO );
export default FunctionIO;