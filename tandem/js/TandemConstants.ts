// Copyright 2021-2025, University of Colorado Boulder

/**
 * Factored-out constant values for use in Tandem.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import PickRequired from '../../phet-core/js/types/PickRequired.js';
import { PhetioElementMetadata } from './phet-io-types.js';
import tandemNamespace from './tandemNamespace.js';

const OBJECT_IO_TYPE_NAME = 'ObjectIO';
const EVENT_TYPE_MODEL = 'MODEL';

const metadataDefaults: PhetioElementMetadata & PickRequired<PhetioElementMetadata, 'phetioFeatured'> = {
  phetioTypeName: OBJECT_IO_TYPE_NAME,
  phetioDocumentation: '',
  phetioState: true,
  phetioReadOnly: false,

  // NOTE: Relies on the details about how Enumerations are serialized (via name), like EventType.phetioType.toStateObject( object.phetioEventType )
  phetioEventType: EVENT_TYPE_MODEL,
  phetioHighFrequency: false,
  phetioPlayback: false,
  phetioDynamicElement: false,
  phetioIsArchetype: false,
  phetioFeatured: false,
  phetioDesigned: false,
  phetioArchetypePhetioID: null
};

// The base definition of allowed characters in a tandem name. In regex form. This will be added to a character
// class (inside `[]`). See isValidTandemName(). This applies to all Tandem subtypes, not just Tandem()
// Allowable terms for tandems, like myObject, or myObject3[1,4], or MyObject
// Note: This allows some tandems we would not prefer, such as "My,Obje[ct", but we will catch that during the design phase.
// Note: This block must go before we start creating static Tandem instances at the bottom of this class.
const BASE_TANDEM_CHARACTER_CLASS = 'a-zA-Z0-9[\\],';
const BASE_DYNAMIC_TANDEM_CHARACTER_CLASS = `${BASE_TANDEM_CHARACTER_CLASS}_`;
const BASE_DERIVED_TANDEM_CHARACTER_CLASS = `${BASE_DYNAMIC_TANDEM_CHARACTER_CLASS}\\-`;

const TandemConstants = {
  OBJECT_IO_TYPE_NAME: OBJECT_IO_TYPE_NAME,
  EVENT_TYPE_MODEL: EVENT_TYPE_MODEL,

  // Default metadata set for an ObjectIO in the PhET-iO API.  These are used as the default options in PhetioObject
  // and when outputting an API (since values that match the defaults are omitted)
  PHET_IO_OBJECT_METADATA_DEFAULTS: metadataDefaults,

  METADATA_KEY_NAME: '_metadata',
  DATA_KEY_NAME: '_data',

  BASE_TANDEM_CHARACTER_CLASS: BASE_TANDEM_CHARACTER_CLASS,
  BASE_DYNAMIC_TANDEM_CHARACTER_CLASS: BASE_DYNAMIC_TANDEM_CHARACTER_CLASS,
  BASE_DERIVED_TANDEM_CHARACTER_CLASS: BASE_DERIVED_TANDEM_CHARACTER_CLASS
} as const;

tandemNamespace.register( 'TandemConstants', TandemConstants );
export default TandemConstants;