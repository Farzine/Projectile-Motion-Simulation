// Copyright 2023-2024, University of Colorado Boulder

/**
 * Property that is set to true when the PhET-iO State Engine is clearing dynamic elements.
 *
 * Marking if we are clearing dynamic elements from instrumented containers. This information is useful because certain
 * logic depends on whether we are setting PhET-iO state but also needs to know about when clearing dynamic elements
 * to handle it separately.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import TinyProperty from '../../axon/js/TinyProperty.js';
import tandemNamespace from './tandemNamespace.js';

const isClearingPhetioDynamicElementsProperty = new TinyProperty( false );

tandemNamespace.register( 'isClearingPhetioDynamicElementsProperty', isClearingPhetioDynamicElementsProperty );

export default isClearingPhetioDynamicElementsProperty;