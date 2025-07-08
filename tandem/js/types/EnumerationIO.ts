// Copyright 2022-2025, University of Colorado Boulder

/**
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import EnumerationValue from '../../../phet-core/js/EnumerationValue.js';
import TEnumeration, { EnumerationContainer } from '../../../phet-core/js/TEnumeration.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import IOTypeCache from '../IOTypeCache.js';
import tandemNamespace from '../tandemNamespace.js';
import IOType from './IOType.js';
import StateSchema from './StateSchema.js';

// Cache each parameterized IOType so that it is only created once.
const cache = new IOTypeCache<IOType<IntentionalAny, string>, TEnumeration<EnumerationValue>>();

const joinKeys = ( keys: string[] ) => keys.join( '|' );

const EnumerationIO = <T extends EnumerationValue>( enumerationContainer: EnumerationContainer<T> ): IOType<T, string> => {
  const enumeration = enumerationContainer.enumeration;

  // This caching implementation should be kept in sync with the other parametric IOType caching implementations.
  if ( !cache.has( enumeration ) ) {

    // Enumeration supports additional documentation, so the values can be described.
    const additionalDocs = enumeration.phetioDocumentation ? ` ${enumeration.phetioDocumentation}` : '';

    const keys = enumeration.keys;
    const values = enumeration.values;

    const ioTypeName = `EnumerationIO(${joinKeys( keys )})`;

    assert && assert(
      !Array.from( cache.values() ).find( ioType => ioType.typeName === ioTypeName ),
      'There was already another IOType with the same name: ' + ioTypeName
    );

    cache.set( enumeration, new IOType<T, string>( ioTypeName, {
      validValues: values,
      documentation: `Possible values: ${keys.join( ', ' )}.${additionalDocs}`,
      toStateObject: ( value: T ) => enumeration.getKey( value ),
      fromStateObject: ( stateObject: string ): T => {
        assert && assert( typeof stateObject === 'string', 'unsupported EnumerationIO value type, expected string' ); // eslint-disable-line phet/no-simple-type-checking-assertions
        assert && assert( keys.includes( stateObject ), `Unrecognized value: ${stateObject}` );
        return enumeration.getValue( stateObject );
      },
      stateSchema: StateSchema.asValue<EnumerationValue, string>( `${joinKeys( keys )}`, {
        isValidValue: ( key: string ) => keys.includes( key )
      } )
    } ) );
  }

  return cache.get( enumeration )!;
};

tandemNamespace.register( 'EnumerationIO', EnumerationIO );
export default EnumerationIO;