// Copyright 2018-2024, University of Colorado Boulder

/**
 * PhET-iO Type for JS's built-in number type, but adds explicit support for positive and negative infinity.
 * Typical use cases should use NumberIO, but if you have a case that must support infinities, please
 * use this instead.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import tandemNamespace from '../tandemNamespace.js';
import IOType from './IOType.js';
import StateSchema from './StateSchema.js';

export type InfiniteNumberStateObject = number | 'POSITIVE_INFINITY' | 'NEGATIVE_INFINITY';

const InfiniteNumberIO = new IOType<number, InfiniteNumberStateObject>( 'InfiniteNumberIO', {
  valueType: 'number',
  documentation: 'PhET-iO Type for Javascript\'s number primitive type',
  toStateObject: value => value === Number.POSITIVE_INFINITY ? 'POSITIVE_INFINITY' :
                          value === Number.NEGATIVE_INFINITY ? 'NEGATIVE_INFINITY' :
                          value,
  fromStateObject: stateObject => stateObject === 'POSITIVE_INFINITY' ? Number.POSITIVE_INFINITY :
                                  stateObject === 'NEGATIVE_INFINITY' ? Number.NEGATIVE_INFINITY :
                                  stateObject,
  stateSchema: StateSchema.asValue<number, InfiniteNumberStateObject>( '\'POSITIVE_INFINITY\'|\'NEGATIVE_INFINITY\'|number', {
    isValidValue: ( value: InfiniteNumberStateObject ) => value === 'POSITIVE_INFINITY' || value === 'NEGATIVE_INFINITY' || ( typeof value === 'number' && !isNaN( value ) )
  } )
} );

tandemNamespace.register( 'InfiniteNumberIO', InfiniteNumberIO );
export default InfiniteNumberIO;