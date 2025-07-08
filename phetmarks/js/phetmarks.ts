// Copyright 2016-2025, University of Colorado Boulder

/**
 * Page for quickly launching phet-related tasks, such as simulations, automated/unit tests, or other utilities.
 *
 * Displays three columns. See type information below for details:
 *
 * - Repositories: A list of repositories to select from, each one of which has a number of modes.
 * - Modes: Based on the repository selected. Decides what type of URL is loaded when "Launch" or the enter key is
 *          pressed.
 * - Query Parameters: If available, controls what optional query parameters will be added to the end of the URL.
 * @author Michael Kauzmann (PhET Interactive Simulations)
 */

( async function(): Promise<void> {
  type PackageJSON = {
    version: string;
    phet: {
      'phet-io': {
        wrappers: string[];
      };
    };
  };
  // QueryParameter has the format
  type PhetmarksQueryParameter = {
    value: string; // The actual query parameter included in the URL,
    text: string; // Display string shown in the query parameter list,

    // defaults to flag, with a checkbox to add the parameter.
    // If boolean, then it will map over to a parameterValues with true/false/sim default radio buttons
    // If parameterValues, must provide "parameterValues" key, where first one is the default.
    type?: 'flag' | 'boolean' | 'parameterValues';

    // * For type=flag: If true, the query parameter will be included by default. This will be false if not provided.
    // * For type=boolean|parameterValues: default should be the defaultValue, and must be in the parameter values and
    // defaults to the first element in parameterValues
    default?: boolean | string;

    // For type='flag' only A "sub query parameter" list that is nested underneath another, and is only available if the parent is checked.
    dependentQueryParameters?: PhetmarksQueryParameter[];

    // Must be provided for type 'parameterValues', if type='boolean', then this is filled in as sim default, true, and false.
    parameterValues?: string[]; // values of the parameter.
    omitIfDefault?: boolean; // if true, omit the default selection of the query parameter, only adding it when changed. Defaults to false
  };

  const demoRepos = [
    'bamboo',
    'griddle',
    'scenery-phet',
    'sun',
    'tambo',
    'vegas'
  ];

  const docRepos = [
    'scenery',
    'kite',
    'dot',
    'phet-io',
    'binder'
  ];

  type RepoName = string; // the name of a repo;

  // Use this as a parameter value to omit the query parameter selection (even if not the default selection)
  const NO_VALUE = 'No Value';

  type MigrationData = {
    sim: string;
    version: string;
  };

  // "General" is the default
  type ModeGroup = 'PhET-iO' | 'General';

  // Mode has the format
  type Mode = {
    name: string; // Internal unique value (for looking up which option was chosen),
    text: string; // Shown in the mode list
    group?: ModeGroup; // The optgroup that this mode belongs to, defaults to "General"
    description: string; // Shown when hovering over the mode in the list,
    url: string; // The base URL to visit (without added query parameters) when the mode is chosen,
    queryParameters?: PhetmarksQueryParameter[];
  };
  type ModeData = Record<RepoName, Mode[]>;
  type RepoSelector = {
    element: HTMLSelectElement;
    get value(): string;
  };

  type ModeSelector = {
    element: HTMLSelectElement;
    value: string;
    mode: Mode;
    update: () => void;
  };

  type QueryParameterSelector = {
    element: HTMLElement;
    value: string; // The single queryString, like `screens=1`, or '' if nothing should be added to the query string.
  };

  type QueryParametersSelector = {
    toggleElement: HTMLElement;
    customElement: HTMLElement;

    // Get the current queryString value based on the current selection.
    value: string;
    update: () => void;
  };

  type ElementToParameterMap = Map<HTMLElement, PhetmarksQueryParameter>;

  // Query parameters that appear in multiple arrays.
  const audioQueryParameter: PhetmarksQueryParameter = {
    value: 'audio',
    text: 'Audio support',
    type: 'parameterValues',
    parameterValues: [ 'enabled', 'disabled', 'muted' ],
    omitIfDefault: true
  };
  const eaQueryParameter: PhetmarksQueryParameter = {
    value: 'ea',
    text: 'Assertions',
    default: true
  };
  const keyboardLocaleSwitcher: PhetmarksQueryParameter = {
    value: 'keyboardLocaleSwitcher',
    text: 'ctrl + u/i to cycle locales'
  };
  const phetioDebugParameter: PhetmarksQueryParameter = {
    value: 'phetioDebug',
    text: 'Enable sim assertions from wrapper',
    type: 'boolean'
  };
  const phetioDebugTrueParameter: PhetmarksQueryParameter = _.assign( {
    default: true
  }, phetioDebugParameter );
  const phetioElementsDisplayParameter: PhetmarksQueryParameter = {
    value: 'phetioElementsDisplay',
    text: 'What PhET-iO Elements to show',
    type: 'parameterValues',
    parameterValues: [ 'all', 'featured' ]
  };
  const phetioPrintAPIProblemsQueryParameter: PhetmarksQueryParameter = {
    value: 'phetioPrintAPIProblems',
    text: 'Print all API problems at once'
  };
  const phetioPrintMissingTandemsQueryParameter: PhetmarksQueryParameter = {
    value: 'phetioPrintMissingTandems',
    text: 'Print uninstrumented tandems'
  };
  const screensQueryParameter: PhetmarksQueryParameter = {
    value: 'screens',
    text: 'Sim Screen',
    type: 'parameterValues',
    parameterValues: [ 'all', '1', '2', '3', '4', '5', '6' ],
    omitIfDefault: true
  };

  const demosQueryParameters: PhetmarksQueryParameter[] = [ {
    value: 'component=Something',
    text: 'Component selection'
  } ];

  const webGLParameter: PhetmarksQueryParameter = { value: 'webgl', text: 'WebGL', type: 'boolean' };

  // Query parameters used for the following modes: unbuilt, compiled, production
  const simQueryParameters: PhetmarksQueryParameter[] = [
    audioQueryParameter, {
      value: 'fuzz', text: 'Fuzz', dependentQueryParameters: [
        { value: 'fuzzPointers=2', text: 'Multitouch-fuzz' }
      ]
    },
    { value: 'fuzzBoard', text: 'Keyboard Fuzz' },
    { value: 'debugger', text: 'Debugger', default: true },
    { value: 'deprecationWarnings', text: 'Deprecation Warnings' },
    { value: 'dev', text: 'Dev' },
    { value: 'profiler', text: 'Profiler' },
    { value: 'showPointers', text: 'Pointers' },
    { value: 'showPointerAreas', text: 'Pointer Areas' },
    { value: 'showFittedBlockBounds', text: 'Fitted Block Bounds' },
    { value: 'showCanvasNodeBounds', text: 'CanvasNode Bounds' },
    { value: 'supportsInteractiveDescription', text: 'Supports Interactive Description', type: 'boolean' },
    { value: 'supportsSound', text: 'Supports Sound', type: 'boolean' },
    { value: 'supportsExtraSound', text: 'Supports Extra Sound', type: 'boolean' },
    { value: 'extraSoundInitiallyEnabled', text: 'Extra Sound on by default' },
    { value: 'supportsPanAndZoom', text: 'Supports Pan and Zoom', type: 'boolean' },
    { value: 'supportsVoicing', text: 'Supports Voicing', type: 'boolean' },
    { value: 'voicingInitiallyEnabled', text: 'Voicing on by default' },
    { value: 'logVoicingResponses', text: 'console.log() voicing responses' },
    { value: 'interactiveHighlightsInitiallyEnabled', text: 'Interactive Highlights on by default' },
    { value: 'preferencesStorage', text: 'Load Preferences from localStorage.' },
    webGLParameter,
    { value: 'disableModals', text: 'Disable Modals' },
    {
      value: 'regionAndCulture',
      text: 'Initial Region and Culture',
      type: 'parameterValues',
      omitIfDefault: true,
      parameterValues: [
        'default',
        'usa',
        'africa',
        'africaModest',
        'asia',
        'latinAmerica',
        'oceania',
        'multi'
      ]
    }, {
      value: 'listenerOrder',
      text: 'Alter listener order',
      type: 'parameterValues',
      omitIfDefault: true,
      parameterValues: [
        'default',
        'reverse',
        'random',
        'random(42)' // very random, do not change
      ]
    },
    keyboardLocaleSwitcher,
    screensQueryParameter
  ];

  const phetBrandQueryParameter = { value: 'brand=phet', text: 'PhET Brand', default: true };

  // Query parameters used for unbuilt and PhET-iO wrappers
  const devSimQueryParameters: PhetmarksQueryParameter[] = [
    phetBrandQueryParameter,
    eaQueryParameter,
    { value: 'eall', text: 'All Assertions' }
  ];

  const phetioBaseParameters: PhetmarksQueryParameter[] = [
    audioQueryParameter, {
      value: 'phetioEmitHighFrequencyEvents',
      type: 'boolean',
      text: 'Emit events that occur often'
    }, {
      value: 'phetioEmitStates',
      type: 'boolean',
      text: 'Emit state events'
    }, {
      value: 'phetioCompareAPI&randomSeed=332211', // NOTE: DUPLICATION ALERT: random seed must match that of API generation, see generatePhetioMacroAPI
      text: 'Compare with reference API'
    },
    phetioPrintMissingTandemsQueryParameter,
    phetioPrintAPIProblemsQueryParameter,
    keyboardLocaleSwitcher, {
      value: 'phetioValidation',
      text: 'Stricter, PhET-iO-specific validation',
      type: 'boolean'
    }, {
      value: 'phetioFuzzValues',
      text: 'Change phetioFeatured values when fuzzing',
      dependentQueryParameters: [
        { value: 'phetioLogFuzzedValues', text: 'console.log featured value changes' }
      ]
    }
  ];

  // See aqua/fuzz-lightyear for details
  const getFuzzLightyearParameters = ( duration = 10000, testTask = true, moreFuzzers = true ): PhetmarksQueryParameter[] => {
    return [
      { value: 'ea&audio=disabled', text: 'general sim params to include', default: true },
      { value: 'randomize', text: 'Randomize' },
      { value: 'reverse', text: 'Reverse' },
      {
        value: 'loadTimeout=30000',
        text: 'time sim has to load',
        default: true
      }, {
        value: `testDuration=${duration}`,
        text: 'fuzz time after load',
        default: true
      }, {
        value: 'fuzzers=2',
        text: 'More fuzzers',
        default: moreFuzzers
      },
      {
        value: 'wrapperName',
        text: 'PhET-iO Wrapper',
        type: 'parameterValues',
        omitIfDefault: true,
        parameterValues: [
          'default',
          'studio',
          'state'
        ]
      }, {
        value: `testTask=${testTask}`,
        text: 'test fuzzing after loading, set to false to just test loading',
        default: true
      }
    ];
  };

  // See perennial-alias/data/wrappers for format
  const nonPublishedPhetioWrappersToAddToPhetmarks: string[] = [];

  // Query parameters for the PhET-iO wrappers (including iframe tests)
  const phetioWrapperQueryParameters: PhetmarksQueryParameter[] = phetioBaseParameters.concat( [ phetioDebugTrueParameter, {
    value: 'phetioWrapperDebug',
    text: 'Enable wrapper-side assertions',
    type: 'boolean',
    default: true
  } ] );

  // For phetio sim frame links
  const phetioSimQueryParameters: PhetmarksQueryParameter[] = phetioBaseParameters.concat( [
    eaQueryParameter, // this needs to be first in this list
    { value: 'brand=phet-io&phetioStandalone&phetioConsoleLog=colorized', text: 'Formatted PhET-IO Console Output' },
    phetioPrintMissingTandemsQueryParameter,
    phetioPrintAPIProblemsQueryParameter, {
      value: 'phetioPrintAPI',
      text: 'Print the API to the console'
    }
  ] );

  const migrationQueryParameters: PhetmarksQueryParameter[] = [ ...phetioWrapperQueryParameters, phetioElementsDisplayParameter ];

  /**
   * Returns a local-storage key that has additional information included, to prevent collision with other applications (or in the future, previous
   * versions of phetmarks).
   */
  function storageKey( key: string ): string {
    return `phetmarks-${key}`;
  }

  /**
   * From the wrapper path in perennial-alias/data/wrappers, get the name of the wrapper.
   */
  const getWrapperName = function( wrapper: string ): string {

    // If the wrapper has its own individual repo, then get the name 'classroom-activity' from 'phet-io-wrapper-classroom-activity'
    // Maintain compatibility for wrappers in 'phet-io-wrappers-'
    const wrapperParts = wrapper.split( 'phet-io-wrapper-' );
    const wrapperName = wrapperParts.length > 1 ?
                        wrapperParts[ 1 ] :
                        wrapper.startsWith( 'phet-io-sim-specific' ) ? wrapper.split( '/' )[ wrapper.split( '/' ).length - 1 ]
                                                                     : wrapper;

    // If the wrapper still has slashes in it, then it looks like 'phet-io-wrappers/active'
    const splitOnSlash = wrapperName.split( '/' );
    return splitOnSlash[ splitOnSlash.length - 1 ];
  };

  // Track whether 'shift' key is pressed, so that we can change how windows are opened.  If shift is pressed, the
  // page is launched in a separate tab.
  let shiftPressed = false;
  let ctrlPressed = false;
  window.addEventListener( 'keydown', event => {
    shiftPressed = event.shiftKey;
    ctrlPressed = event.ctrlKey;
  } );
  window.addEventListener( 'keyup', event => {
    shiftPressed = event.shiftKey;
    ctrlPressed = event.ctrlKey;
  } );

  function openURL( url: string ): void {
    if ( shiftPressed ) {
      window.open( url, '_blank' );
    }
    else if ( ctrlPressed ) {
      window.open( url );
      window.focus();
    }
    else {

      // @ts-expect-error - the browser supports setting to a string.
      window.location = url;
    }
  }

  /**
   * Fills out the modeData map with information about repositories, modes and query parameters. Parameters are largely
   * repo lists from perennial-alias/data files.
   *
   */
  function populate( activeRunnables: RepoName[], activeRepos: RepoName[], phetioSims: RepoName[],
                     interactiveDescriptionSims: RepoName[], wrappers: string[],
                     unitTestsRepos: RepoName[], phetioHydrogenSims: MigrationData[], phetioPackageJSONs: Record<RepoName, PackageJSON> ): ModeData {
    const modeData: ModeData = {};

    activeRepos.forEach( ( repo: RepoName ) => {
      const modes: Mode[] = [];
      modeData[ repo ] = modes;

      const isPhetio = _.includes( phetioSims, repo );
      const hasUnitTests = _.includes( unitTestsRepos, repo );
      const isRunnable = _.includes( activeRunnables, repo );
      const supportsInteractiveDescription = _.includes( interactiveDescriptionSims, repo );

      if ( isRunnable ) {
        modes.push( {
          name: 'unbuilt',
          text: 'Unbuilt',
          description: 'Runs the simulation from the top-level development HTML in unbuilt mode',
          url: `../${repo}/${repo}_en.html`,
          queryParameters: [
            ...devSimQueryParameters,
            ...( demoRepos.includes( repo ) ? demosQueryParameters : [] ),
            ...simQueryParameters
          ]
        } );
        modes.push( {
          name: 'compiled',
          text: 'Compiled',
          description: 'Runs the English simulation from the build/phet/ directory (built from chipper)',
          url: `../${repo}/build/phet/${repo}_en_phet.html`,
          queryParameters: simQueryParameters
        } );
        modes.push( {
          name: 'compiledXHTML',
          text: 'Compiled XHTML',
          description: 'Runs the English simulation from the build/phet/xhtml directory (built from chipper)',
          url: `../${repo}/build/phet/xhtml/${repo}_all.xhtml`,
          queryParameters: simQueryParameters
        } );
        modes.push( {
          name: 'production',
          text: 'Production',
          description: 'Runs the latest English simulation from the production server',
          url: `https://phet.colorado.edu/sims/html/${repo}/latest/${repo}_all.html`,
          queryParameters: simQueryParameters
        } );
        modes.push( {
          name: 'spot',
          text: 'Dev (bayes)',
          description: 'Loads the location on phet-dev.colorado.edu with versions for each dev deploy',
          url: `https://phet-dev.colorado.edu/html/${repo}`
        } );

        // Color picker UI
        modes.push( {
          name: 'colors',
          text: 'Color Editor',
          description: 'Runs the top-level -colors.html file (allows editing/viewing different profile colors)',
          url: `color-editor.html?sim=${repo}`,
          queryParameters: [ phetBrandQueryParameter ]
        } );
      }

      if ( repo === 'scenery' ) {
        modes.push( {
          name: 'inspector',
          text: 'Inspector',
          description: 'Displays saved Scenery snapshots',
          url: `../${repo}/tests/inspector.html`
        } );
      }

      if ( repo === 'phet-io' ) {
        modes.push( {
          name: 'test-studio-sims',
          text: 'Fuzz Test Studio Wrapper',
          description: 'Runs automated testing with fuzzing on studio, 15 second timer',
          url: '../aqua/fuzz-lightyear/',
          queryParameters: getFuzzLightyearParameters( 15000 ).concat( [ {
            value: `fuzz&wrapperName=studio&wrapperContinuousTest=%7B%7D&repos=${phetioSims.join( ',' )}`,
            text: 'Fuzz Test PhET-IO sims',
            default: true
          } ] )
        } );
        modes.push( {
          name: 'test-migration-sims',
          text: 'Fuzz Test Migration',
          description: 'Runs automated testing with fuzzing on studio, 10 second timer',
          url: '../aqua/fuzz-lightyear/',
          queryParameters: getFuzzLightyearParameters( 20000 ).concat( migrationQueryParameters ).concat( [ {
            value: 'fuzz&wrapperName=migration&wrapperContinuousTest=%7B%7D&migrationRate=2000&' +
                   `phetioMigrationReport=assert&repos=${phetioHydrogenSims.map( simData => simData.sim ).join( ',' )}`,
            text: 'Fuzz Test PhET-IO sims',
            default: true
          } ] )
        } );
        modes.push( {
          name: 'test-state-sims',
          text: 'Fuzz Test State Wrapper',
          description: 'Runs automated testing with fuzzing on state, 15 second timer',
          url: '../aqua/fuzz-lightyear/',
          queryParameters: getFuzzLightyearParameters( 15000 ).concat( [ {
            value: `fuzz&wrapperName=state&setStateRate=3000&wrapperContinuousTest=%7B%7D&repos=${phetioSims.join( ',' )}`,
            text: 'Fuzz Test PhET-IO sims',
            default: true
          } ] )
        } );
      }

      if ( repo === 'phet-io-website' ) {
        modes.push( {
          name: 'viewRoot',
          text: 'View Local',
          description: 'view the local roon of the website',
          url: `../${repo}/root/`
        } );
      }

      if ( hasUnitTests ) {
        modes.push( {
          name: 'unitTestsUnbuilt',
          text: 'Unit Tests (unbuilt)',
          description: 'Runs unit tests in unbuilt mode',
          url: `../${repo}/${repo}-tests.html`,
          queryParameters: [
            eaQueryParameter,
            { value: 'brand=phet-io', text: 'PhET-iO Brand', default: repo === 'phet-io' || repo === 'tandem' || repo === 'phet-io-wrappers' },
            ...( repo === 'phet-io-wrappers' ? [ { value: 'sim=gravity-and-orbits', text: 'neededTestParams', default: true } ] : [] )
          ]
        } );
      }
      if ( docRepos.includes( repo ) ) {
        modes.push( {
          name: 'documentation',
          text: 'Documentation',
          description: 'Browse HTML documentation',
          url: `../${repo}/doc${repo === 'binder' ? 's' : ''}/`
        } );
      }
      if ( repo === 'scenery' ) {
        modes.push( {
          name: 'basics-documentation',
          text: 'Basics Documentation',
          description: 'Scenery Basics Documentation',
          url: 'https://scenerystack.org/learn/scenery-basics/'
        } );
        modes.push( {
          name: 'layout-documentation',
          text: 'Layout Documentation',
          description: 'Scenery Layout Documentation',
          url: 'https://scenerystack.org/learn/scenery-layout/'
        } );
        modes.push( {
          name: 'input-documentation',
          text: 'Input Documentation',
          description: 'Scenery Input Documentation',
          url: 'https://scenerystack.org/learn/scenery-input/'
        } );
        modes.push( {
          name: 'accessibility-documentation',
          text: 'Accessibility Documentation',
          description: 'Scenery Accessibility Documentation',
          url: 'https://scenerystack.org/learn/scenery-accessibility/'
        } );
      }
      if ( repo === 'scenery' || repo === 'kite' || repo === 'dot' ) {
        modes.push( {
          name: 'examples',
          text: 'Examples',
          description: 'Browse Examples',
          url: `../${repo}/examples/`
        } );
      }
      if ( repo === 'scenery' || repo === 'kite' || repo === 'dot' || repo === 'phet-core' ) {
        modes.push( {
          name: 'playground',
          text: 'Playground',
          description: `Loads ${repo} and dependencies in the tab, and allows quick testing`,
          url: `../${repo}/tests/playground.html`
        } );
      }
      if ( repo === 'scenery' ) {
        modes.push( {
          name: 'sandbox',
          text: 'Sandbox',
          description: 'Allows quick testing of Scenery features',
          url: `../${repo}/tests/sandbox.html`
        } );
      }
      if ( repo === 'chipper' || repo === 'aqua' ) {
        modes.push( {
          name: 'test-phet-sims',
          text: 'Fuzz Test PhET Sims',
          description: 'Runs automated testing with fuzzing, 10 second timer',
          url: '../aqua/fuzz-lightyear/',
          queryParameters: getFuzzLightyearParameters().concat( [ {
            value: 'brand=phet&fuzz',
            text: 'Fuzz PhET sims',
            default: true
          } ] )
        } );
        modes.push( {
          name: 'test-phet-io-sims',
          text: 'Fuzz Test PhET-iO Sims',
          description: 'Runs automated testing with fuzzing, 10 second timer',
          url: '../aqua/fuzz-lightyear/',
          queryParameters: getFuzzLightyearParameters().concat( [ {
            value: 'brand=phet-io&fuzz&phetioStandalone',
            text: 'Fuzz PhET-IO brand',
            default: true
          }, {
            value: `repos=${phetioSims.join( ',' )}`,
            text: 'Test only PhET-iO sims',
            default: true
          } ] )
        } );
        modes.push( {
          name: 'test-interactive-description-sims',
          text: 'Fuzz Test Interactive Description Sims',
          description: 'Runs automated testing with fuzzing, 10 second timer',
          url: '../aqua/fuzz-lightyear/',

          // only one fuzzer because two iframes cannot both receive focus/blur events
          queryParameters: getFuzzLightyearParameters( 10000, true, false ).concat( [
            phetBrandQueryParameter, {
              value: 'fuzzBoard&supportsInteractiveDescription=true',
              text: 'Keyboard Fuzz Test sims',
              default: true
            }, {
              value: 'fuzz&supportsInteractiveDescription=true',
              text: 'Normal Fuzz Test sims'
            }, {
              value: `repos=${interactiveDescriptionSims.join( ',' )}`,
              text: 'Test only A11y sims',
              default: true
            } ] )
        } );
        modes.push( {
          name: 'fuzz-sims-load-only',
          text: 'Load Sims',
          description: 'Runs automated testing that just loads sims (without fuzzing or building)',
          url: '../aqua/fuzz-lightyear/',
          queryParameters: getFuzzLightyearParameters( 10000, false ).concat( [ phetBrandQueryParameter ] )
        } );
        modes.push( {
          name: 'continuous-testing',
          text: 'Continuous Testing',
          description: 'Link to the continuous testing on Bayes.',
          url: 'sparky.colorado.edu/continuous-testing/aqua/html/continuous-report.html?maxColumns=10'
        } );
        modes.push( {
          name: 'continuous-testing-local',
          text: 'Continuous Testing (local unbuilt)',
          description: 'Link to the continuous testing on Bayes.',
          url: '../aqua/html/continuous-unbuilt-report.html?server=https://sparky.colorado.edu/&maxColumns=10'
        } );

        // Shared by old and multi snapshop comparison.
        const sharedComparisonQueryParameters: PhetmarksQueryParameter[] = [
          {
            value: 'simSeed=123',
            text: 'Custom seed (defaults to a non random value)'
          },
          {
            value: `simWidth=${1024 / 2}`,
            text: 'Larger sim width'
          },
          {
            value: `simHeight=${768 / 2}`,
            text: 'Larger sim height'
          },
          {
            value: 'numFrames=30',
            text: 'more comparison frames'
          }
        ];
        modes.push( {
          name: 'snapshot-comparison',
          text: 'Snapshot Comparison',
          description: 'Sets up snapshot screenshot comparison that can be run on different SHAs',
          url: '../aqua/html/snapshot-comparison.html',
          queryParameters: [
            eaQueryParameter,
            {
              value: 'repos=density,buoyancy',
              text: 'Sims to compare'
            },
            {
              value: 'randomSims=10',
              text: 'Test a random number of sims'
            },
            ...sharedComparisonQueryParameters,
            {
              value: 'simQueryParameters=ea',
              text: 'sim frame parameters'
            },
            {
              value: 'showTime',
              text: 'show time taken for each snpashot',
              type: 'boolean'
            },
            {
              value: 'compareDescription',
              text: 'compare description PDOM and text too',
              type: 'boolean'
            }
          ]
        } );
        modes.push( {
          name: 'multi-snapshot-comparison',
          text: 'Multi-snapshot Comparison',
          description: 'Sets up snapshot screenshot comparison for two different checkouts',
          url: '../aqua/html/multi-snapshot-comparison.html',
          queryParameters: [
            eaQueryParameter,
            {
              value: 'repos=density,buoyancy',
              text: 'Sims to compare'
            },
            {
              value: 'urls=http://localhost,http://localhost:8080',
              text: 'Testing urls',
              default: true
            },
            ...sharedComparisonQueryParameters,
            {
              value: 'testPhetio',
              type: 'boolean',
              text: 'Test PhET-iO Brand'
            },
            {
              value: 'simQueryParameters=ea',
              text: 'sim parameters (not ?brand)',
              default: true
            },
            {
              value: 'copies=1',
              text: 'IFrames per column'
            }
          ]
        } );
      }
      if ( repo === 'yotta' ) {
        modes.push( {
          name: 'yotta-statistics',
          text: 'Statistics page',
          description: 'Goes to the yotta report page, credentials in the Google Doc',
          url: 'https://bayes.colorado.edu/statistics/yotta/'
        } );
      }
      if ( repo === 'skiffle' ) {
        modes.push( {
          name: 'sound-board',
          text: 'Sound Board',
          description: 'Interactive HTML page for exploring existing sounds in sims and common code',
          url: '../skiffle/html/sound-board.html'
        } );
      }
      if ( repo === 'quake' ) {
        modes.push( {
          name: 'quake-built',
          text: 'Haptics Playground (built for browser)',
          description: 'Built browser version of the Haptics Playground app',
          url: '../quake/platforms/browser/www/haptics-playground.html'
        } );
      }

      if ( repo === 'phettest' ) {
        modes.push( {
          name: 'phettest',
          text: 'PhET Test',
          description: 'local version of phettest pointing to the server on bayes',
          url: '../phettest/'
        } );
      }

      if ( supportsInteractiveDescription ) {
        modes.push( {
          name: 'a11y-view',
          text: 'A11y View',
          description: 'Runs the simulation in an iframe next to a copy of the PDOM to easily inspect accessible content.',
          url: `../chipper/wrappers/a11y-view/?sim=${repo}`,
          queryParameters: devSimQueryParameters.concat( simQueryParameters )
        } );
      }

      if ( repo === 'interaction-dashboard' ) {
        modes.push( {
          name: 'preprocessor',
          text: 'Preprocessor',
          description: 'Load the preprocessor for parsing data logs down to a size that can be used by the simulation.',
          url: `../${repo}/preprocessor.html`,
          queryParameters: [ eaQueryParameter, {
            value: 'parseX=10',
            text: 'Test only 10 sessions'
          }, {
            value: 'forSpreadsheet',
            text: 'Create output for a spreadsheet.'
          } ]
        } );
      }

      modes.push( {
        name: 'github',
        text: 'GitHub',
        description: 'Opens to the repository\'s GitHub main page',
        url: `https://github.com/phetsims/${repo}`
      } );
      modes.push( {
        name: 'issues',
        text: 'Issues',
        description: 'Opens to the repository\'s GitHub issues page',
        url: `https://github.com/phetsims/${repo}/issues`
      } );

      // if a phet-io sim, then add the wrappers to them
      if ( isPhetio ) {

        // Add the console logging, not a wrapper but nice to have
        modes.push( {
          name: 'one-sim-wrapper-tests',
          text: 'Wrapper Unit Tests',
          group: 'PhET-iO',
          description: 'Test the PhET-iO API for this sim.',

          // Each sim gets its own test, just run sim-less tests here
          url: `../phet-io-wrappers/phet-io-wrappers-tests.html?sim=${repo}`,
          queryParameters: phetioWrapperQueryParameters
        } );

        // Add a link to the compiled wrapper index;
        modes.push( {
          name: 'compiled-index',
          text: 'Compiled Index',
          group: 'PhET-iO',
          description: 'Runs the PhET-iO wrapper index from build/ directory (built from chipper)',
          url: `../${repo}/build/phet-io/`,
          queryParameters: phetioWrapperQueryParameters
        } );

        modes.push( {
          name: 'standalone',
          text: 'Standalone',
          group: 'PhET-iO',
          description: 'Runs the sim in phet-io brand with the standalone query parameter',
          url: `../${repo}/${repo}_en.html?brand=phet-io&phetioStandalone`,
          queryParameters: phetioSimQueryParameters.concat( simQueryParameters )
        } );

        const simSpecificWrappers = phetioPackageJSONs[ repo ]?.phet[ 'phet-io' ]?.wrappers || [];
        const allWrappers = wrappers.concat( nonPublishedPhetioWrappersToAddToPhetmarks ).concat( simSpecificWrappers );

        // phet-io wrappers
        _.sortBy( allWrappers, getWrapperName ).forEach( wrapper => {

          const wrapperName = getWrapperName( wrapper );

          let url = '';

          // Process for dedicated wrapper repos
          if ( wrapper.startsWith( 'phet-io-wrapper-' ) ) {

            // Special use case for the sonification wrapper
            url = wrapperName === 'sonification' ? `../phet-io-wrapper-${wrapperName}/${repo}-sonification.html?sim=${repo}` :
                  `../${wrapper}/?sim=${repo}`;
          }
          // Load the wrapper urls for the phet-io-wrappers/
          else {
            url = `../${wrapper}/?sim=${repo}`;
          }

          // add recording to the console by default
          if ( wrapper === 'phet-io-wrappers/record' ) {
            url += '&console';
          }

          let queryParameters: PhetmarksQueryParameter[] = [];
          if ( wrapperName === 'studio' ) {

            // So we don't mutate the common list
            const studioQueryParameters = [ ...phetioWrapperQueryParameters ];

            // Studio defaults to phetioDebug=true, so this parameter can't be on by default
            _.remove( studioQueryParameters, item => item === phetioDebugTrueParameter );

            queryParameters = studioQueryParameters.concat( [ phetioDebugParameter, phetioElementsDisplayParameter ] );
          }
          else if ( wrapperName === 'migration' ) {
            queryParameters = [
              ...migrationQueryParameters,
              { ...webGLParameter, default: true }, { // eslint-disable-line phet/no-object-spread-on-non-literals
                value: 'phetioMigrationReport',
                type: 'parameterValues',
                text: 'How should the migration report be reported?',
                parameterValues: [ 'dev', 'client', 'verbose', 'assert' ],
                omitIfDefault: false
              }
            ];
          }
          else if ( wrapperName === 'state' ) {
            queryParameters = [ ...phetioWrapperQueryParameters, {
              value: 'setStateRate=1000',
              text: 'Customize the "set state" rate for how often a state is set to the downstream sim (in ms)',
              default: true
            }, {
              value: 'logTiming',
              text: 'Console log the amount of time it took to set the state of the simulation.'
            } ];
          }
          else if ( wrapperName === 'playback' ) {
            queryParameters = [];
          }
          else {
            queryParameters = phetioWrapperQueryParameters;
          }

          modes.push( {
            name: wrapperName,
            text: wrapperName,
            group: 'PhET-iO',
            description: `Runs the phet-io wrapper ${wrapperName}`,
            url: url,
            queryParameters: queryParameters
          } );
        } );

        // Add the console logging, not a wrapper but nice to have
        modes.push( {
          name: 'colorized',
          text: 'Data: colorized',
          group: 'PhET-iO',
          description: 'Show the colorized event log in the console of the stand alone sim.',
          url: `../${repo}/${repo}_en.html?brand=phet-io&phetioConsoleLog=colorized&phetioStandalone&phetioEmitHighFrequencyEvents=false`,
          queryParameters: phetioSimQueryParameters.concat( simQueryParameters )
        } );
      }
    } );

    return modeData;
  }

  function clearChildren( element: HTMLElement ): void {
    while ( element.childNodes.length ) { element.removeChild( element.childNodes[ 0 ] ); }
  }

  function createRepositorySelector( repositories: RepoName[] ): RepoSelector {
    const select = document.createElement( 'select' );
    select.autofocus = true;
    repositories.forEach( repo => {
      const option = document.createElement( 'option' );
      option.value = option.label = option.innerHTML = repo;
      select.appendChild( option );
    } );

    // IE or no-scrollIntoView will need to be height-limited
    // @ts-expect-error
    if ( select.scrollIntoView && !navigator.userAgent.includes( 'Trident/' ) ) {
      select.setAttribute( 'size', `${repositories.length}` );
    }
    else {
      select.setAttribute( 'size', '30' );
    }

    // Select a repository if it's been stored in localStorage before
    const repoKey = storageKey( 'repo' );
    const value = localStorage.getItem( repoKey );
    if ( value ) {
      select.value = value;
    }

    select.focus();

    // Scroll to the selected element
    function tryScroll(): void {
      const element = select.childNodes[ select.selectedIndex ] as HTMLElement;

      // @ts-expect-error
      if ( element.scrollIntoViewIfNeeded ) {
        // @ts-expect-error
        element.scrollIntoViewIfNeeded();
      }
      else if ( element.scrollIntoView ) {
        element.scrollIntoView();
      }
    }

    select.addEventListener( 'change', tryScroll );
    // We need to wait for things to load fully before scrolling (in Chrome).
    // See https://github.com/phetsims/phetmarks/issues/13
    setTimeout( tryScroll, 0 );

    return {
      element: select,
      get value() {
        // @ts-expect-error - it is an HTMLElement, not just a node
        return select.childNodes[ select.selectedIndex ].value;
      }
    };
  }

  function createModeSelector( modeData: ModeData, repositorySelector: RepoSelector ): ModeSelector {
    const select = document.createElement( 'select' );

    const selector = {
      element: select,
      get value() {
        return select.value;
      },
      get mode() {
        const currentModeName = selector.value;
        return _.filter( modeData[ repositorySelector.value ], mode => {
          return mode.name === currentModeName;
        } )[ 0 ];
      },
      update: function() {
        localStorage.setItem( storageKey( 'repo' ), repositorySelector.value );

        clearChildren( select );

        const groups: Partial<Record<ModeGroup, HTMLOptGroupElement>> = {};
        modeData[ repositorySelector.value ].forEach( ( choice: Mode ) => {
          const choiceOption = document.createElement( 'option' );
          choiceOption.value = choice.name;
          choiceOption.label = choice.text;
          choiceOption.title = choice.description;
          choiceOption.innerHTML = choice.text;

          // add to an `optgroup` instead of having all modes on the `select`
          choice.group = choice.group || 'General';

          // create if the group doesn't exist
          if ( !groups[ choice.group ] ) {
            const optGroup = document.createElement( 'optgroup' );
            optGroup.label = choice.group;
            groups[ choice.group ] = optGroup;
            select.appendChild( optGroup );
          }

          // add the choice to the property group
          groups[ choice.group ]!.appendChild( choiceOption );
        } );

        select.setAttribute( 'size', modeData[ repositorySelector.value ].length + Object.keys( groups ).length + '' );
        if ( select.selectedIndex < 0 ) {
          select.selectedIndex = 0;
        }
      }
    };

    return selector;
  }

  // Create control for type 'parameterValues', and also 'boolean' which has hard coded values true/false/sim default.
  function createParameterValuesSelector( queryParameter: PhetmarksQueryParameter ): QueryParameterSelector {

    // We don't want to mutate the provided data
    queryParameter = _.assignIn( {}, queryParameter );

    if ( queryParameter.type === 'boolean' ) {
      assert && assert( !queryParameter.hasOwnProperty( 'parameterValues' ), 'parameterValues are filled in for boolean' );
      assert && assert( !queryParameter.hasOwnProperty( 'omitIfDefault' ), 'omitIfDefault is filled in for boolean' );
      queryParameter.parameterValues = [ 'true', 'false', NO_VALUE ];

      // sim default is the default for booleans
      if ( !queryParameter.hasOwnProperty( 'default' ) ) {
        queryParameter.default = NO_VALUE;
      }
    }
    else {
      assert && assert( queryParameter.type === 'parameterValues', `parameterValues type only please: ${queryParameter.value} - ${queryParameter.type}` );
    }
    assert && assert( queryParameter.parameterValues, 'parameterValues expected' );
    assert && assert( queryParameter.parameterValues!.length > 0, 'parameterValues expected (more than 0 of them)' );
    assert && assert( !queryParameter.hasOwnProperty( 'dependentQueryParameters' ),
      'type=parameterValues and type=boolean do not support dependent query parameters at this time.' );

    const div = document.createElement( 'div' );
    const queryParameterName = queryParameter.value;
    const parameterValues = queryParameter.parameterValues!;

    const providedADefault = queryParameter.hasOwnProperty( 'default' );
    const theProvidedDefault = queryParameter.default + '';
    if ( providedADefault ) {
      assert && assert( parameterValues.includes( theProvidedDefault ),
        `parameter default for ${queryParameterName} is not an available value: ${theProvidedDefault}` );
    }

    const defaultValue = providedADefault ? theProvidedDefault : parameterValues[ 0 ];

    const createParameterValuesRadioButton = ( value: string ): HTMLElement => {
      const label = document.createElement( 'label' );
      label.className = 'choiceLabel';
      const radio = document.createElement( 'input' );
      radio.type = 'radio';
      radio.name = queryParameterName;
      radio.value = value;
      radio.checked = value === defaultValue;
      label.appendChild( radio );
      label.appendChild( document.createTextNode( value ) ); // use the query parameter value as the display text for clarity
      return label;
    };

    const bullet = document.createElement( 'span' );
    bullet.innerHTML = '⚫';
    bullet.className = 'bullet';
    div.appendChild( bullet );
    const label = document.createTextNode( `${queryParameter.text} (?${queryParameterName})` );
    div.appendChild( label );
    for ( let i = 0; i < parameterValues.length; i++ ) {
      div.appendChild( createParameterValuesRadioButton( parameterValues[ i ] ) );
    }
    return {
      element: div,
      get value() {
        const radioButtonValue = $( `input[name=${queryParameterName}]:checked` ).val() + '';

        // A value of "Simulation Default" tells us not to provide the query parameter.
        const omitQueryParameter = radioButtonValue === NO_VALUE ||
                                   ( queryParameter.omitIfDefault && radioButtonValue === defaultValue );
        return omitQueryParameter ? '' : `${queryParameterName}=${radioButtonValue}`;
      }
    };
  }

  // get Flag checkboxes as their individual query strings (in a list), but only if they are different from their default.
  function getFlagParameters( toggleContainer: HTMLElement ): string[] {
    const checkboxElements = $( toggleContainer ).find( '.flagParameter' ) as unknown as HTMLInputElement[];

    // Only checked boxed.
    return _.filter( checkboxElements, ( checkbox: HTMLInputElement ) => checkbox.checked )
      .map( ( checkbox: HTMLInputElement ) => checkbox.name );
  }

  // Create a checkbox to toggle if the flag parameter should be added to the mode URL
  function createFlagSelector( parameter: PhetmarksQueryParameter, toggleContainer: HTMLElement,
                               elementToQueryParameter: ElementToParameterMap ): void {
    assert && assert( !parameter.hasOwnProperty( 'parameterValues' ), 'parameterValues are for type=parameterValues' );
    assert && assert( !parameter.hasOwnProperty( 'omitIfDefault' ), 'omitIfDefault are for type=parameterValues' );

    assert && parameter.hasOwnProperty( 'default' ) && assert( typeof parameter.default === 'boolean', 'default is a boolean for flags' );

    const label = document.createElement( 'label' );
    const checkbox = document.createElement( 'input' );
    checkbox.type = 'checkbox';
    checkbox.name = parameter.value;
    checkbox.classList.add( 'flagParameter' );
    label.appendChild( checkbox );
    assert && assert( !elementToQueryParameter.has( checkbox ), 'sanity check for overwriting' );
    elementToQueryParameter.set( checkbox, parameter );

    const queryParameterDisplay = parameter.value;

    label.appendChild( document.createTextNode( `${parameter.text} (?${queryParameterDisplay})` ) );
    toggleContainer.appendChild( label );
    toggleContainer.appendChild( document.createElement( 'br' ) );
    checkbox.checked = !!parameter.default;

    if ( parameter.dependentQueryParameters ) {

      /**
       * Creates a checkbox whose value is dependent on another checkbox, it is only used if the parent
       * checkbox is checked.
       */
      const createDependentCheckbox = ( label: string, value: string, checked: boolean ): HTMLDivElement => {
        const dependentQueryParametersContainer = document.createElement( 'div' );

        const dependentCheckbox = document.createElement( 'input' );
        dependentCheckbox.id = getDependentParameterControlId( value );
        dependentCheckbox.type = 'checkbox';
        dependentCheckbox.name = value;
        dependentCheckbox.classList.add( 'flagParameter' );
        dependentCheckbox.style.marginLeft = '40px';
        dependentCheckbox.checked = checked;
        const labelElement = document.createElement( 'label' );
        labelElement.appendChild( document.createTextNode( label ) );
        labelElement.htmlFor = dependentCheckbox.id;

        dependentQueryParametersContainer.appendChild( dependentCheckbox );
        dependentQueryParametersContainer.appendChild( labelElement );

        // checkbox becomes unchecked and disabled if dependency checkbox is unchecked
        const enableButton = () => {
          dependentCheckbox.disabled = !checkbox.checked;
          if ( !checkbox.checked ) {
            dependentCheckbox.checked = false;
          }
        };
        checkbox.addEventListener( 'change', enableButton );
        enableButton();

        return dependentQueryParametersContainer;
      };

      const containerDiv = document.createElement( 'div' );
      parameter.dependentQueryParameters.forEach( relatedParameter => {
        const dependentCheckbox = createDependentCheckbox( `${relatedParameter.text} (?${relatedParameter.value})`, relatedParameter.value, !!relatedParameter.default );
        containerDiv.appendChild( dependentCheckbox );
      } );
      toggleContainer.appendChild( containerDiv );
    }
  }

  function createQueryParametersSelector( modeSelector: ModeSelector ): QueryParametersSelector {

    const customTextBox = document.createElement( 'input' );
    customTextBox.type = 'text';

    const toggleContainer = document.createElement( 'div' );

    let elementToQueryParameter: ElementToParameterMap = new Map();
    const parameterValuesSelectors: QueryParameterSelector[] = [];

    return {
      toggleElement: toggleContainer,
      customElement: customTextBox,
      get value() {

        // flag query parameters, in string form
        const flagQueryParameters = getFlagParameters( toggleContainer );
        const parameterValuesQueryParameters = parameterValuesSelectors
          .map( ( selector: QueryParameterSelector ) => selector.value )
          .filter( ( queryParameter: string ) => queryParameter !== '' );

        const customQueryParameters = customTextBox.value.length ? [ customTextBox.value ] : [];

        return flagQueryParameters.concat( parameterValuesQueryParameters ).concat( customQueryParameters ).join( '&' );
      },
      update: function() {
        // Rebuild based on a new mode/repo change

        elementToQueryParameter = new Map();
        parameterValuesSelectors.length = 0;
        clearChildren( toggleContainer );

        const queryParameters = modeSelector.mode.queryParameters || [];
        queryParameters.forEach( parameter => {
          if ( parameter.type === 'parameterValues' || parameter.type === 'boolean' ) {
            const selector = createParameterValuesSelector( parameter );
            toggleContainer.appendChild( selector.element );
            parameterValuesSelectors.push( selector );
          }
          else {
            createFlagSelector( parameter, toggleContainer, elementToQueryParameter );
          }
        } );
      }
    };
  }

  /**
   * Create the view and hook everything up.
   */
  function render( modeData: ModeData ): void {
    const repositorySelector = createRepositorySelector( Object.keys( modeData ) );
    const modeSelector = createModeSelector( modeData, repositorySelector );
    const queryParameterSelector = createQueryParametersSelector( modeSelector );

    function getCurrentURL(): string {
      const queryParameters = queryParameterSelector.value;
      const url = modeSelector.mode.url;
      const separator = url.includes( '?' ) ? '&' : '?';
      return url + ( queryParameters.length ? separator + queryParameters : '' );
    }

    const launchButton = document.createElement( 'button' );
    launchButton.id = 'launchButton';
    launchButton.name = 'launch';
    launchButton.innerHTML = 'Launch';

    const resetButton = document.createElement( 'button' );
    resetButton.name = 'reset';
    resetButton.innerHTML = 'Reset Query Parameters';

    function header( string: string ): HTMLElement {
      const head = document.createElement( 'h3' );
      head.appendChild( document.createTextNode( string ) );
      return head;
    }

    // Divs for our three columns
    const repoDiv = document.createElement( 'div' );
    repoDiv.id = 'repositories';
    const modeDiv = document.createElement( 'div' );
    modeDiv.id = 'choices';
    const queryParametersDiv = document.createElement( 'div' );
    queryParametersDiv.id = 'queryParameters';

    // Layout of all the major elements
    repoDiv.appendChild( header( 'Repositories' ) );
    repoDiv.appendChild( repositorySelector.element );
    modeDiv.appendChild( header( 'Modes' ) );
    modeDiv.appendChild( modeSelector.element );
    modeDiv.appendChild( document.createElement( 'br' ) );
    modeDiv.appendChild( document.createElement( 'br' ) );
    modeDiv.appendChild( launchButton );
    queryParametersDiv.appendChild( header( 'Query Parameters' ) );
    queryParametersDiv.appendChild( queryParameterSelector.toggleElement );
    queryParametersDiv.appendChild( document.createTextNode( 'Query Parameters: ' ) );
    queryParametersDiv.appendChild( queryParameterSelector.customElement );
    queryParametersDiv.appendChild( document.createElement( 'br' ) );
    queryParametersDiv.appendChild( resetButton );
    document.body.appendChild( repoDiv );
    document.body.appendChild( modeDiv );
    document.body.appendChild( queryParametersDiv );

    function updateQueryParameterVisibility(): void {
      queryParametersDiv.style.visibility = modeSelector.mode.queryParameters ? 'inherit' : 'hidden';
    }

    // Align panels based on width
    function layout(): void {
      modeDiv.style.left = `${repositorySelector.element.clientWidth + 20}px`;
      queryParametersDiv.style.left = `${repositorySelector.element.clientWidth + +modeDiv.clientWidth + 40}px`;
    }

    window.addEventListener( 'resize', layout );

    // Hook updates to change listeners
    function onRepositoryChanged(): void {
      modeSelector.update();
      onModeChanged();
    }

    function onModeChanged(): void {
      queryParameterSelector.update();
      updateQueryParameterVisibility();
      layout();
    }

    repositorySelector.element.addEventListener( 'change', onRepositoryChanged );
    modeSelector.element.addEventListener( 'change', onModeChanged );
    onRepositoryChanged();

    // Clicking 'Launch' or pressing 'enter' opens the URL
    function openCurrentURL(): void {
      openURL( getCurrentURL() );
    }

    window.addEventListener( 'keydown', event => {
      // Check for enter key
      if ( event.which === 13 ) {
        openCurrentURL();
      }
    }, false );
    launchButton.addEventListener( 'click', openCurrentURL );

    // Reset by redrawing everything
    resetButton.addEventListener( 'click', queryParameterSelector.update );
  }

  async function loadPackageJSONs( repos: RepoName[] ): Promise<Record<RepoName, PackageJSON>> {
    const packageJSONs: Record<RepoName, PackageJSON> = {};
    for ( const repo of repos ) {
      packageJSONs[ repo ] = await $.ajax( { url: `../${repo}/package.json` } );
    }
    return packageJSONs;
  }

  // Splits file strings (such as perennial-alias/data/active-runnables) into a list of entries, ignoring blank lines.
  function whiteSplitAndSort( rawDataList: string ): RepoName[] {
    return rawDataList.split( '\n' ).map( line => {
      return line.replace( '\r', '' );
    } ).filter( line => {
      return line.length > 0;
    } ).sort();
  }

  // get the ID for a checkbox that is "dependent" on another value
  const getDependentParameterControlId = ( value: string ) => `dependent-checkbox-${value}`;

  // Load files serially, populate then render
  const activeRunnables = whiteSplitAndSort( await $.ajax( { url: '../perennial-alias/data/active-runnables' } ) );
  const activeRepos = whiteSplitAndSort( await $.ajax( { url: '../perennial-alias/data/active-repos' } ) );
  const phetioSims = whiteSplitAndSort( await $.ajax( { url: '../perennial-alias/data/phet-io' } ) );
  const interactiveDescriptionSims = whiteSplitAndSort( await $.ajax( { url: '../perennial-alias/data/interactive-description' } ) );
  const wrappers = whiteSplitAndSort( await $.ajax( { url: '../perennial-alias/data/wrappers' } ) );
  const unitTestsRepos = whiteSplitAndSort( await $.ajax( { url: '../perennial-alias/data/unit-tests' } ) );
  const phetioHydrogenSims = await $.ajax( { url: '../perennial-alias/data/phet-io-hydrogen.json' } );

  let phetioPackageJSONs: Record<RepoName, PackageJSON> = {};
  try {
    phetioPackageJSONs = await loadPackageJSONs( phetioSims );
  }
  catch( e ) {
    console.log( 'perchance there are no phet-io sims' );
  }

  render( populate( activeRunnables, activeRepos, phetioSims, interactiveDescriptionSims, wrappers, unitTestsRepos, phetioHydrogenSims, phetioPackageJSONs ) );
} )().catch( ( e: Error ) => {
  throw e;
} );