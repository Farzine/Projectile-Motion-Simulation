// Copyright 2023-2024, University of Colorado Boulder

/**
 * The PhetioStateEngine is defined in the phet-io/ repo, so is not available to developers that cannot clone that repo.
 * Describe the interface explicitly here.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import Emitter from '../../axon/js/Emitter.js';
import { TReadOnlyEmitter } from '../../axon/js/TEmitter.js';
import TReadOnlyProperty from '../../axon/js/TReadOnlyProperty.js';
import { FullPhetioState } from './phet-io-types.js';
import PhetioObject from './PhetioObject.js';

export type TPhetioStateEngine = {
  onBeforeApplyStateEmitter: TReadOnlyEmitter<[ PhetioObject ]>;
  undeferEmitter: Emitter<[ FullPhetioState ]>;
  isSettingStateProperty: TReadOnlyProperty<boolean>;
};