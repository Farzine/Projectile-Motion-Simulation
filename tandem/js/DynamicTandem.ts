// Copyright 2019-2024, University of Colorado Boulder

/**
 * A tandem for a dynamic element that stores the name of the archetype that defines its dynamic element's schema.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Chris Klusendorf (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import optionize, { EmptySelfOptions } from '../../phet-core/js/optionize.js';
import StrictOmit from '../../phet-core/js/types/StrictOmit.js';
import Tandem, { TandemOptions } from './Tandem.js';
import TandemConstants from './TandemConstants.js';
import tandemNamespace from './tandemNamespace.js';

type DynamicTandemOptions = StrictOmit<TandemOptions, 'isValidTandemName'>;

class DynamicTandem extends Tandem {

  public constructor( parentTandem: Tandem, name: string, providedOptions?: DynamicTandemOptions ) {
    assert && assert( parentTandem, 'DynamicTandem must have a parentTandem' );
    const options = optionize<DynamicTandemOptions, EmptySelfOptions, TandemOptions>()( {
      isValidTandemName: ( name: string ) => Tandem.getRegexFromCharacterClass( TandemConstants.BASE_DYNAMIC_TANDEM_CHARACTER_CLASS ).test( name )
    }, providedOptions );
    super( parentTandem, name, options );
  }
}

tandemNamespace.register( 'DynamicTandem', DynamicTandem );
export default DynamicTandem;