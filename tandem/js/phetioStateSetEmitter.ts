// Copyright 2024, University of Colorado Boulder

/**
 * emits the state after each time the PhetioStateEngine has set all that it can for the
 * provided state. The first argument to the emit call is the state object literal that was set.
 * Use the second argument to check if a client Tandem is in the scope of the current set state.
 * This is because some state set calls only set partial state (like for a screen/scene).
 * For example: stateSetEmitter.addListener( ( state, scopeTandem )=> if( myTandem.hasAncestor( scopeTandem ) ){ . . . } )
 *
 * Note that this emitter emits after all state logic has occurred, but while isSettingPhetioStateProperty is still "true"
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import Emitter from '../../axon/js/Emitter.js';
import TEmitter, { TReadOnlyEmitter } from '../../axon/js/TEmitter.js';
import { FullPhetioState } from './phet-io-types.js';
import Tandem from './Tandem.js';
import tandemNamespace from './tandemNamespace.js';

// This one is for specialized usage in the PhetioStateEngine, which changes the value. DO NOT USE in sim code!
export const writablePhetioStateSetEmitter: TEmitter<[ FullPhetioState, Tandem ]> = new Emitter( {
  parameters: [ { valueType: Object },
    { valueType: Tandem } ]
} );

// Simulations can use this one to observe the value
const phetioStateSetEmitter: TReadOnlyEmitter<[ FullPhetioState, Tandem ]> = writablePhetioStateSetEmitter;

tandemNamespace.register( 'phetioStateSetEmitter', phetioStateSetEmitter );

export default phetioStateSetEmitter;