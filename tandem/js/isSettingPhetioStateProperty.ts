// Copyright 2023-2024, University of Colorado Boulder

/**
 * Property that is set to true when the PhET-iO State Engine is setting the state of a simulation. This Property
 * is valuable for checking is PhET-iO state-setting is occurring in your listeners. It is not advised to listen
 * to this Property for sim-specific state logic. Instead, use TANDEM/phetioStateSetEmitter.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import TinyProperty from '../../axon/js/TinyProperty.js';
import TReadOnlyProperty from '../../axon/js/TReadOnlyProperty.js';
import tandemNamespace from './tandemNamespace.js';

// This one is for specialized usage in the PhetioStateEngine, which changes the value. DO NOT USE in sim code.
export const writableIsSettingPhetioStateProperty = new TinyProperty( false );

// Simulations can use this one to observe the value
const isSettingPhetioStateProperty: TReadOnlyProperty<boolean> = writableIsSettingPhetioStateProperty;

tandemNamespace.register( 'isSettingPhetioStateProperty', isSettingPhetioStateProperty );

export default isSettingPhetioStateProperty;