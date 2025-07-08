// Copyright 2020-2025, University of Colorado Boulder

/**
 * Constants used in PhET-iO. Defined in the tandem repo since they need to be accessed in non-private code, like
 * IOType.ObjectIO.
 * @author Sam Reid (PhET Interactive Simulations)
 */

import tandemNamespace from './tandemNamespace.js';

const PhetioConstants = {

  // Suffix that is required for all IOType class names
  IO_TYPE_SUFFIX: 'IO'
};

tandemNamespace.register( 'PhetioConstants', PhetioConstants );
export default PhetioConstants;