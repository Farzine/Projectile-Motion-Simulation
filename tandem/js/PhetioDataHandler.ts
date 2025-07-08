// Copyright 2022-2025, University of Colorado Boulder

/**
 * Helper type that supports a `parameters` member.
 * This is mostly useful for PhET-iO instrumented sub-class to use that takes a variable number of parameters in their
 * IOType. With this function you gain parameter validation, PhET-iO documentation, and data stream support.
 *
 * @author Sam Reid (PhET Interactive Simulations)
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

import validate from '../../axon/js/validate.js';
import Validation, { Validator } from '../../axon/js/Validation.js';
import assertMutuallyExclusiveOptions from '../../phet-core/js/assertMutuallyExclusiveOptions.js';
import optionize from '../../phet-core/js/optionize.js';
import IntentionalAny from '../../phet-core/js/types/IntentionalAny.js';
import StrictOmit from '../../phet-core/js/types/StrictOmit.js';
import PhetioObject, { PhetioObjectOptions } from './PhetioObject.js';
import Tandem from './Tandem.js';
import tandemNamespace from './tandemNamespace.js';
import { AnyIOType } from './types/IOType.js';

const VALIDATE_OPTIONS_FALSE = { validateValidator: false };

export type Parameter = {
  name?: string;
  phetioDocumentation?: string;
  phetioPrivate?: boolean;
} & Validator;

// Simulations have thousands of Emitters, so we re-use objects where possible.
const EMPTY_ARRAY: Parameter[] = [];
assert && Object.freeze( EMPTY_ARRAY );

// Allowed keys to options.parameters, the parameters to emit.
const PARAMETER_KEYS = [
  'name', // required for phet-io instrumented Actions
  'phetioType', // required for phet-io instrumented Actions
  'phetioDocumentation', // optional, additional documentation for this specific parameter

  // Specify this to keep the parameter private to the PhET-iO API. To support emitting and executing over the PhET-iO
  // API, phetioPrivate parameters must not ever be before a public one. For example `emit1( public1, private1, public2)`
  // is not allowed. Instead, it must be ordered like `emit( public1, public2, private1 )`
  'phetioPrivate'

].concat( Validation.VALIDATOR_KEYS );

// helper closures
const paramToPhetioType = ( param: Parameter ) => param.phetioType!;
const paramToName = ( param: Parameter ) => param.name!;

type SelfOptions = {

  // The parameters to the emit method that will be called.
  // See PARAMETER_KEYS for a list of legal keys, their types, and documentation.
  parameters?: Parameter[];
  phetioOuterType: ( t: AnyIOType[] ) => AnyIOType;
  hasListenerOrderDependencies?: boolean;
};

// Use each subtype should provide its own phetioOuterType. That coupled with parameter IOTypes will result in the
// phetioType. Don't pass this in!
export type PhetioDataHandlerOptions = SelfOptions & StrictOmit<PhetioObjectOptions, 'phetioType'>;

class PhetioDataHandler<T extends IntentionalAny[] = []> extends PhetioObject {

  private readonly parameters: Parameter[];

  public constructor( providedOptions?: PhetioDataHandlerOptions ) {
    const options = optionize<PhetioDataHandlerOptions, SelfOptions, PhetioObjectOptions>()( {

      // SelfOptions
      parameters: EMPTY_ARRAY,
      hasListenerOrderDependencies: false,

      // phet-io - see PhetioObject.js for doc
      phetioPlayback: PhetioObject.DEFAULT_OPTIONS.phetioPlayback,
      phetioEventMetadata: PhetioObject.DEFAULT_OPTIONS.phetioEventMetadata,
      phetioDocumentation: ''
    }, providedOptions );

    assert && PhetioDataHandler.validateParameters( options.parameters, !!options.tandem?.supplied );
    assert && assert( options.phetioType === undefined,
      'PhetioDataHandler sets its own phetioType. Instead provide parameter phetioTypes through `options.parameters` with a phetioOuterType' );

    // list of parameters, see options.parameters. Filter out phetioPrivate parameters, all `phetioPrivate`
    // parameters will not have a `phetioType`, see `validateParameters`.
    const phetioPublicParameters = options.parameters.filter( paramToPhetioType );

    options.phetioType = options.phetioOuterType( phetioPublicParameters.map( paramToPhetioType ) );

    // phetioPlayback events need to know the order the arguments occur in order to call EmitterIO.emit()
    // Indicate whether the event is for playback, but leave this "sparse"--only indicate when this happens to be true
    if ( options.phetioPlayback ) {
      options.phetioEventMetadata = options.phetioEventMetadata || {}; // phetioEventMetadata defaults to null

      assert && assert( !options.phetioEventMetadata.hasOwnProperty( 'dataKeys' ),
        'dataKeys should be supplied by PhetioDataHandler, not elsewhere' );

      options.phetioEventMetadata.dataKeys = options.parameters.map( paramToName );
    }
    options.phetioDocumentation = PhetioDataHandler.getPhetioDocumentation( options.phetioDocumentation, phetioPublicParameters );

    super( options );

    // Note: one test indicates stripping this out via assert && in builds may save around 300kb heap
    this.parameters = options.parameters;
  }

  /**
   * @param parameters
   * @param tandemSupplied - proxy for whether the PhetioObject is instrumented.  We cannot call
   *                                 - PhetioObject.isPhetioInstrumented() until after the supercall, so we use this beforehand.
   */
  private static validateParameters( parameters: Parameter[], tandemSupplied: boolean ): void {

    // validate the parameters object
    validate( parameters, { valueType: Array } );

    // PhetioDataHandler only supports phetioPrivate parameters at the end of the emit call, so once we hit the first phetioPrivate
    // parameter, then assert that the rest of them afterwards are as well.
    let reachedPhetioPrivate = false;

    // we must iterate from the first parameter to the last parameter to support phetioPrivate
    for ( let i = 0; i < parameters.length; i++ ) {
      const parameter = parameters[ i ]; // metadata about a single parameter

      assert && assert( Object.getPrototypeOf( parameter ) === Object.prototype,
        'Extra prototype on parameter object is a code smell' );

      reachedPhetioPrivate = reachedPhetioPrivate || parameter.phetioPrivate!;
      assert && reachedPhetioPrivate && assert( parameter.phetioPrivate,
        'after first phetioPrivate parameter, all subsequent parameters must be phetioPrivate' );

      assert && tandemSupplied && Tandem.VALIDATION && assert( parameter.phetioType || parameter.phetioPrivate,
        'instrumented Emitters must include phetioType for each parameter or be marked as `phetioPrivate`.' );
      assert && parameter.phetioType && assert( parameter.name,
        '`name` is a required parameter for phet-io instrumented parameters.' );
      assert && assertMutuallyExclusiveOptions( parameter, [ 'phetioPrivate' ], [
        'name', 'phetioType', 'phetioDocumentation'
      ] );

      assert && assert( _.intersection( Object.keys( parameter ), Validation.VALIDATOR_KEYS ).length > 0,
        `validator must be specified for parameter ${i}` );

      for ( const key in parameter ) {
        assert && assert( PARAMETER_KEYS.includes( key ), `unrecognized parameter key: ${key}` );
      }

      // Changing after construction indicates a logic error.
      assert && Object.freeze( parameters[ i ] );

      // validate the options passed in to validate each PhetioDataHandler argument
      Validation.validateValidator( parameter );
    }

    // Changing after construction indicates a logic error.
    assert && Object.freeze( parameters );
  }

  /**
   * Validate that provided args match the expected schema given via options.parameters.
   */
  protected validateArguments( ...args: T ): void {
    assert && assert( args.length === this.parameters.length,
      `Emitted unexpected number of args. Expected: ${this.parameters.length} and received ${args.length}`
    );
    for ( let i = 0; i < this.parameters.length; i++ ) {
      const parameter = this.parameters[ i ];
      assert && validate( args[ i ], parameter, VALIDATE_OPTIONS_FALSE );

      // valueType overrides the phetioType validator so we don't use that one if there is a valueType
      if ( parameter.phetioType && !parameter.valueType ) {
        assert && validate( args[ i ], parameter.phetioType.validator, VALIDATE_OPTIONS_FALSE );
      }
    }
  }

  /**
   * Validate that provided args match the expected schema given via options.parameters.
   */
  public getValidationErrors( ...args: T ): Array<string | null> {
    assert && assert( args.length === this.parameters.length,
      `Emitted unexpected number of args. Expected: ${this.parameters.length} and received ${args.length}`
    );
    return this.parameters.map( ( parameter, index ) => {
      return Validation.getValidationError( args[ index ], parameter, VALIDATE_OPTIONS_FALSE );
    } );
  }

  /**
   * Gets the data that will be emitted to the PhET-iO data stream, for an instrumented simulation.
   * @returns the data, keys dependent on parameter metadata
   */
  public getPhetioData( ...args: T ): null | Record<string, unknown> {

    assert && assert( Tandem.PHET_IO_ENABLED, 'should only get phet-io data in phet-io brand' );

    // null if there are no arguments. dataStream.js omits null values for data
    let data: Record<string, object> | null = null;
    if ( this.parameters.length > 0 ) {

      // Enumerate named argsObject for the data stream.
      data = {};
      for ( let i = 0; i < this.parameters.length; i++ ) {
        const element = this.parameters[ i ];
        if ( !element.phetioPrivate ) {
          assert && assert( element.name, 'name required' );
          data[ element.name! ] = element.phetioType!.toStateObject( args[ i ] );
        }
      }
    }
    return data;
  }

  /**
   * Get the phetioDocumentation compiled from all the parameters
   */
  private static getPhetioDocumentation( currentPhetioDocumentation: string, parameters: Parameter[] ): string {
    const paramToDocString = ( param: Parameter ) => {

      const docText = param.phetioDocumentation ? ` - ${param.phetioDocumentation}` : '';

      return `<li>${param.name}: ${_.escape( param.phetioType!.typeName )}${docText}</li>`;
    };

    return currentPhetioDocumentation + ( parameters.length === 0 ? '<br>No parameters.' : `${'<br>The parameters are:<br/>' +
           '<ol>'}${parameters.map( paramToDocString ).join( '<br/>' )}</ol>` );
  }
}

tandemNamespace.register( 'PhetioDataHandler', PhetioDataHandler );
export default PhetioDataHandler;