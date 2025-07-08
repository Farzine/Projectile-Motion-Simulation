// Copyright 2023-2025, University of Colorado Boulder

/**
 * Property that controls the view of PhET-iO Elements, predominantly in Studio.
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 * @author Sam Reid (PhET Interactive Simulations)
 */

import Property from '../../axon/js/Property.js';
import Tandem from './Tandem.js';
import tandemNamespace from './tandemNamespace.js';
import StringIO from './types/StringIO.js';

export const PhetioElementsDisplayValues = [
  'featured',
  'all'
] as const;

export type PhetioElementsDisplay = ( typeof PhetioElementsDisplayValues )[number];

const initialValue: PhetioElementsDisplay = Tandem.PHET_IO_ENABLED ?
                                            window.phet.preloads.phetio.queryParameters.phetioElementsDisplay :
                                            'featured';

const phetioElementsDisplayProperty = new Property<PhetioElementsDisplay>( initialValue, {
  tandem: Tandem.GENERAL_VIEW.createTandem( 'phetioElementsDisplayProperty' ),
  phetioValueType: StringIO,
  validValues: PhetioElementsDisplayValues,
  phetioState: false,
  phetioDocumentation: 'Specifies the current display selection for PhET-iO Elements.'
} );

tandemNamespace.register( 'phetioElementsDisplayProperty', phetioElementsDisplayProperty );

export default phetioElementsDisplayProperty;