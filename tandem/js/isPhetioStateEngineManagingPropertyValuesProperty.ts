// Copyright 2023-2024, University of Colorado Boulder

/**
 * Property that is set to true when the PhET-iO State Engine is managing Property values, see ReadOnlyProperty.set()
 *
 * phet-io internal, do not use in sims.
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 * @author Sam Reid (PhET Interactive Simulations)
 */

import TinyProperty from '../../axon/js/TinyProperty.js';
import tandemNamespace from './tandemNamespace.js';

const isPhetioStateEngineManagingPropertyValuesProperty = new TinyProperty( false );

tandemNamespace.register( 'isPhetioStateEngineManagingPropertyValuesProperty', isPhetioStateEngineManagingPropertyValuesProperty );

export default isPhetioStateEngineManagingPropertyValuesProperty;