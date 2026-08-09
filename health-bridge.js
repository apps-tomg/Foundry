// Apple Health bridge. Read-only by design: Foundry pulls in figures you have
// already recorded elsewhere and writes nothing back, because writing creates
// duplicate and conflict problems with whatever else is syncing to Health.
//
// Deliberately limited to steps, bodyweight, and blood pressure. Nutrition is
// not available: HealthKit exposes dietary energy and macros, but no current
// Capacitor plugin surfaces them, so calories and protein stay manual entry.
(function(){
  var isNative = typeof window.Capacitor !== 'undefined' &&
                 window.Capacitor.isNativePlatform &&
                 window.Capacitor.isNativePlatform();

  function plugin(){
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Health) || null;
  }

  window.FoundryHealth = {
    isNative: isNative,

    available: async function(){
      var P = plugin();
      if(!isNative || !P) return false;
      try{
        var res = await P.isAvailable();
        return !!(res && res.available);
      }catch(e){ return false; }
    },

    // Only ever asks for read scopes. The write array stays empty so iOS never
    // offers the person a permission Foundry has no use for.
    requestAccess: async function(types){
      var P = plugin();
      if(!isNative || !P) return null;
      try{
        return await P.requestAuthorization({ read: types, write: [] });
      }catch(e){
        console.error('FoundryHealth: authorization failed', e);
        return null;
      }
    },

    // Daily step totals, aggregated natively rather than pulling thousands of
    // individual samples and summing them in JavaScript.
    dailySteps: async function(days){
      var P = plugin();
      if(!isNative || !P) return [];
      var start = new Date();
      start.setHours(0,0,0,0);
      start.setDate(start.getDate() - (days - 1));
      try{
        var res = await P.queryAggregated({
          dataType: 'steps',
          startDate: start.toISOString(),
          endDate: new Date().toISOString(),
          bucket: 'day',
          aggregation: 'sum'
        });
        return (res && res.samples) || [];
      }catch(e){
        console.error('FoundryHealth: steps query failed', e);
        return [];
      }
    },

    latestSamples: async function(dataType, days, limit){
      var P = plugin();
      if(!isNative || !P) return [];
      var start = new Date();
      start.setDate(start.getDate() - days);
      try{
        var res = await P.readSamples({
          dataType: dataType,
          startDate: start.toISOString(),
          endDate: new Date().toISOString(),
          limit: limit || 30
        });
        return (res && res.samples) || [];
      }catch(e){
        console.error('FoundryHealth: ' + dataType + ' query failed', e);
        return [];
      }
    }
  };
})();
