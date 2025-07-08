// Copyright 2023-2025, University of Colorado Boulder

/**
 * A cache that helps reuse parametric IOTypes so they aren't dynamic created upon each usage. This also has the feature
 * of keeping a registry of all caches. This is predominantly used to clear an API and start over in phetioEngine.
 *
 * @author Michael Kauzmann (PhET Interactive Simulations)
 * @author Sam Reid (PhET Interactive Simulations)
 */

import tandemNamespace from './tandemNamespace.js';
import type { AnyIOType } from './types/IOType.js';


// By default, the cache key is an IOType (like for a single parameter like PropertyIO)
class IOTypeCache<Value extends AnyIOType, Key = AnyIOType> extends Map<Key, Value> {

  private static readonly caches: IOTypeCache<AnyIOType, unknown>[] = [];

  public constructor( entries?: readonly ( readonly [ Key, Value ] )[] | null ) {
    super( entries );

    IOTypeCache.caches.push( this );
  }

  public static clearAll(): void {
    IOTypeCache.caches.forEach( cache => cache.clear() );
  }
}

tandemNamespace.register( 'IOTypeCache', IOTypeCache );
export default IOTypeCache;