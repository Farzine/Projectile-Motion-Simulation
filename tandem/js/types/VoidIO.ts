// Copyright 2018-2025, University of Colorado Boulder

/**
 * IOType use to signify a function has no return value.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Andrew Adare (PhET Interactive Simulations)
 */

import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import tandemNamespace from '../tandemNamespace.js';
import IOType from './IOType.js';

/**
 * We sometimes use VoidIO as a workaround to indicate that an argument is passed in the simulation side, but
 * that it shouldn't be leaked to the PhET-iO client.
 */
const VoidIO = new IOType<IntentionalAny, undefined>( 'VoidIO', {
  isValidValue: () => true,
  documentation: 'Type for which there is no instance, usually to mark functions without a return value',
  toStateObject: () => undefined
} );

tandemNamespace.register( 'VoidIO', VoidIO );
export default VoidIO;