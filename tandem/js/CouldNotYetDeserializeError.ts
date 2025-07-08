// Copyright 2019-2022, University of Colorado Boulder

/**
 * Error to be thrown if a failure occurs downstream of setting state because another state setting operation needs
 * to occur before "this" operation can succeed. For example, in reference serialization for dynamic PhetioObjects,
 * the dynamic instance must be created by the state engine before anything can reference it. By triggering this error,
 * we say "a failure here is alright, we will try again on the next iteration of setting the state. See
 * `phetioStateEngine.iterate` for more information.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 * @author Chris Klusendorf (PhET Interactive Simulations)
 */

import tandemNamespace from './tandemNamespace.js';

class CouldNotYetDeserializeError extends Error {
  public constructor() {
    super( 'CouldNotYetDeserializeError' );  // Do not change this message without consulting appropriate usages.
  }
}

tandemNamespace.register( 'CouldNotYetDeserializeError', CouldNotYetDeserializeError );
export default CouldNotYetDeserializeError;