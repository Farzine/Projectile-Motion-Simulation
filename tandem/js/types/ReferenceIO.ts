// Copyright 2019-2025, University of Colorado Boulder

/**
 * ReferenceIO uses reference identity for toStateObject/fromStateObject
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Chris Klusendorf (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import Validation from '../../../axon/js/Validation.js';
import CouldNotYetDeserializeError from '../CouldNotYetDeserializeError.js';
import IOTypeCache from '../IOTypeCache.js';
import { PhetioID } from '../phet-io-types.js';
import PhetioObject from '../PhetioObject.js';
import Tandem from '../Tandem.js';
import tandemNamespace from '../tandemNamespace.js';
import IOType, { AnyIOType } from './IOType.js';
import StringIO from './StringIO.js';

// Cache each parameterized ReferenceIO so that it is only created once
const cache = new IOTypeCache<IOType<PhetioObject, ReferenceIOState>>();

// TODO: Rename to "ReferenceState"? https://github.com/phetsims/tandem/issues/261
export type ReferenceIOState = {
  phetioID: PhetioID;
};

// TODO: Parameterize so that it is a subtype of PhetioObject, https://github.com/phetsims/tandem/issues/261
const ReferenceIO = ( parameterType: AnyIOType ): IOType<PhetioObject, ReferenceIOState> => {
  assert && assert( parameterType, 'ReferenceIO needs parameterType' );

  const cacheKey = parameterType;

  if ( !cache.has( cacheKey ) ) {

    cache.set( cacheKey, new IOType<PhetioObject, ReferenceIOState>( `ReferenceIO<${parameterType.typeName}>`, {
      isValidValue: value => Validation.isValueValid( value, parameterType.validator ),
      documentation: 'Uses reference identity for serializing and deserializing, and validates based on its parameter PhET-iO Type.',
      parameterTypes: [ parameterType ],

      /**
       * Return the json that ReferenceIO is wrapping.  This can be overridden by subclasses, or types can use ReferenceIO type
       * directly to use this implementation.
       */
      toStateObject( phetioObject ): ReferenceIOState {
        assert && Tandem.VALIDATION && assert( phetioObject.isPhetioInstrumented(), 'Cannot reference an uninstrumented object', phetioObject );

        // NOTE: We cannot assert that phetioObject.phetioState === false here because sometimes ReferenceIO is used statically like
        // ReferenceIO( Vector2IO ).toStateObject( myVector );
        return {
          phetioID: phetioObject.tandem.phetioID
        };
      },

      stateSchema: {
        phetioID: StringIO
      },

      /**
       * Decodes the object from a state, used in PhetioStateEngine.setState.  This can be overridden by subclasses, or types can
       * use ReferenceIO type directly to use this implementation.
       * @throws CouldNotYetDeserializeError
       */
      fromStateObject( stateObject: ReferenceIOState ) {
        assert && assert( stateObject && typeof stateObject.phetioID === 'string', 'phetioID should be a string' );
        if ( phet.phetio.phetioEngine.hasPhetioObject( stateObject.phetioID ) ) {
          return phet.phetio.phetioEngine.getPhetioElement( stateObject.phetioID );
        }
        else {
          throw new CouldNotYetDeserializeError();
        }
      },

      /**
       * References should be using fromStateObject to get a copy of the PhET-iO Element.
       */
      applyState( coreObject ) {
        assert && assert( false,
          'ReferenceIO is meant to be used as data-type serialization (see fromStateObject). ' +
          'Did you forget phetioState: false? ' +
          `phetioID: ${coreObject.tandem.phetioID}` );
      }
    } ) );
  }

  return cache.get( cacheKey )!;
};

tandemNamespace.register( 'ReferenceIO', ReferenceIO );
export default ReferenceIO;