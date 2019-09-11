const Promise = require('bluebird');
const promisify = require('promisify-node');
const request = promisify('request');

const find = require('lodash/find');
const { cleanAddons, hasName } = require('./cleanAddons');

const Registry = require('npm-registry');
const npm = new Registry({ registry: 'https://registry.npmjs.org/' });

const EMBER_OBSERVER_API_URL =
  'https://www.emberobserver.com/api/v2/autocomplete_data';
const IGNORE_ADDON_PATTERNS = [
  /fill-murray-?/,
  /fill-murry/,
  /test-addonasdasdcxvsdfsfsbsdfscxvcvxdvsdfsdfsdfxcvxcvs12431123mvhxcvxcvx/
];
const NPM_COUCH_DB_URL =
  'https://skimdb.npmjs.com/registry/_design/app/_view/byKeyword?startkey=["ember-addon"]&endkey=["ember-addon",{}]&group_level=3';
const NPMS_IO_SEARCH_URL = 'https://api.npms.io/v2/search?q=ember&size=250';

/**
 * Get names of all ember related npm packages.
 */
async function getAll() {
  let from = 0;
  let addons = [];
  while (from <= 5000) {
	  let response = await request({ url: `${NPMS_IO_SEARCH_URL}&from=${from}`, json: true });
	  let foundAddons = response.body.results.reduce((filteredAddons, row) => {
		let name = row.package.name;
		let ignoreAddon = IGNORE_ADDON_PATTERNS.every(
		  (pattern) => !pattern.test(name)
		);

		if (hasName({ name }) && ignoreAddon) {
		  filteredAddons.push({
			  name: name,
			  date: row.package.date
		  });
		}

		return filteredAddons;
	  }, []);

	addons.push(...foundAddons);
	from += 250;
  }
  return addons;
}



function _getDetails(name) {
  return new Promise((resolve, reject) => {
	// HACK: The currect npm client (3rd-Eden/npmjs) is too old to support scoped
	// packages and assumes @ in a package name specifies the version to retrieve
    // It thus replaces it (via name.replace) with a / to form the final url
	// So, we just write our own replace method that returns the full name!
    let nameHack = {
	  replace: () => name
    };
    npm.packages.get(nameHack, (error, result) => {
      if (error) {
        // pass
        resolve([null]);
      } else {
        resolve(result);
      }
    });
  });
}

async function getDetailsForAddons(addons) {
  const filtered = addons.filter(hasName);
  let result = [];
  for (let addon of filtered) {
    try {
      console.log('--> Fetching addon info:', addon.name);
      let details = await _getDetails(addon.name);

	  if (details[0]) {
	      result.push(details[0]);
	  }
    } catch (e) {
      // pass
      console.log('--> Error getting:', addon.name);
    }
  }
  return result;
}

function sortAddons(addons) {
  console.log('--> Sorting...');

  addons.sort(function(a, b) {
    return b.time.modified - a.time.modified;
  });

  return Promise.resolve(addons);
}

function getScoreForAddons(addons) {
  console.log('--> Getting scores...');

  return request(EMBER_OBSERVER_API_URL).then(function(response) {
    const observerData = JSON.parse(response.body).addons;

    addons.forEach(function(addon) {
      const score = find(observerData, { name: addon.name });

      if (score) {
        if (score.is_wip) {
          // WIP
          addon.emberObserver = { score: -1 };
        } else if (!score.score) {
          // No review
          addon.emberObserver = { score: -2 };
        } else {
          // Score!
          addon.emberObserver = { score: score.score };
        }
      } else {
        // No review
        addon.emberObserver = { score: -2 };
      }
    });

    return addons;
  });
}

function getDetails(allAddons) {
  return getDetailsForAddons(allAddons)
    .then(getScoreForAddons)
    .then(cleanAddons)
    .then(sortAddons);
}

module.exports = {
  getDetails: getDetails,
  getAll: getAll
};
