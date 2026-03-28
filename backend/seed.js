const mongoose = require('mongoose');
const Player = require('./models/Player');

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const seedPlayers = async () => {
  return new Promise((resolve, reject) => {
    const results = [];
    let totalBase = 0;
    let validBaseCount = 0;

    fs.createReadStream(path.join(__dirname, 'ipl_2025_auction_players.csv'))
      .pipe(csv())
      .on('data', (data) => {
        let baseValue = null;
        if (data.Base && data.Base !== '-' && !isNaN(parseFloat(data.Base))) {
          baseValue = parseFloat(data.Base) * 10000000; // Convert to Crores
          totalBase += baseValue;
          validBaseCount++;
        }
        
        let mappedRole = 'All-rounder';
        if (data.Type === 'BAT') mappedRole = 'Batsman';
        if (data.Type === 'BOWL') mappedRole = 'Bowler';
        if (data.Type === 'AR') mappedRole = 'All-rounder';
        if (data.Type === 'WK') mappedRole = 'Wicket Keeper';

        const overseasNames = new Set([
          "Jos Buttler", "Pat Cummins", "Travis Head", "Heinrich Klaasen", "Rashid Khan", "Nicholas Pooran", 
          "Kagiso Rabada", "Mitchell Starc", "Liam Livingstone", "David Miller", "Harry Brook", "Devon Conway", 
          "Jake Fraser-McGurk", "Aiden Markram", "David Warner", "Mitchell Marsh", "Glenn Maxwell", "Marcus Stoinis", 
          "Jonny Bairstow", "Quinton de Kock", "Rahmanullah Gurbaz", "Phil Salt", "Trent Boult", "Josh Hazlewood", 
          "Anrich Nortje", "Noor Ahmad", "Wanindu Hasaranga", "Maheesh Theekshana", "Adam Zampa", "Faf du Plessis", 
          "Glenn Phillips", "Rovman Powell", "Kane Williamson", "Sam Curran", "Marco Jansen", "Donovan Ferreira", 
          "Shai Hope", "Josh Inglis", "Ryan Rickelton", "Gerald Coetzee", "Lockie Ferguson", "Akeal Hosein", 
          "Keshav Maharaj", "Mujeeb Ur Rahman", "Adil Rashid", "Rilee Rossouw", "Sherfane Rutherford", "Ashton Turner", 
          "James Vince", "Moeen Ali", "Tim David", "Will Jacks", "Azmatullah Omarzai", "Romario Shepherd", 
          "Tom Banton", "Sam Billings", "Jordan Cox", "Ben McDermott", "Kusal Mendis", "Kusal Perera", "Josh Philippe", 
          "Tim Seifert", "Nandre Burger", "Mustafizur Rahman", "Naveen-ul-Haq", "Rishad Hossain", "Zahir Khan", 
          "Tanveer Sangha", "Tabraiz Shamsi", "Jeffrey Vandersay", "Finn Allen", "Dewald Brevis", "Ben Duckett", 
          "Matthew Breetzke", "Mark Chapman", "Brandon King", "Evin Lewis", "Pathum Nissanka", "Bhanuka Rajapaksa", 
          "Steven Smith", "Gus Atkinson", "Tom Curran", "Mohammad Nabi", "Gulbadin Naib", "Sikandar Raza", 
          "Mitchell Santner", "Johnson Charles", "Litton Das", "Andre Fletcher", "Tom Latham", "Ollie Pope", 
          "Kyle Verreynne", "Fazalhaq Farooqi", "Richard Gleeson", "Matt Henry", "Alzarri Joseph", "Kwena Maphaka", 
          "Reece Topley", "Lizaad Williams", "Luke Wood", "Leus du Plooy", "Towhid Hridoy", "Mikyle Louis", 
          "Harry Tector", "Rassie van der Dussen", "Will Young", "Najibullah Zadran", "Ibrahim Zadran", "Sean Abbott", 
          "Jacob Bethell", "Brydon Carse", "Aaron Hardie", "Kyle Mayers", "Kamindu Mendis", "Matthew Short", 
          "Jason Behrendorff", "Dushmantha Chameera", "Nathan Ellis", "Shamar Joseph", "Josh Little", "Jhye Richardson", 
          "Shakib Al Hasan", "Mehidy Hasan Miraz", "Wiaan Mulder", "Dwaine Pretorius", "Dasun Shanaka", "Shoriful Islam", 
          "Blessing Muzarabani", "Matthew Potts", "Tanzim Hasan Sakib", "Ben Sears", "Tim Southee", "James Anderson", 
          "Kyle Jamieson", "Chris Jordan", "Tymal Mills", "David Payne", "Ashton Agar", "Roston Chase", "Junior Dala", 
          "Mahedi Hasan", "Dan Lawrence", "Alick Athanaze", "Hilton Cartwright", "Dominic Drakes", "Daryn Dupavillon", 
          "Matthew Forde", "Patrick Kruger", "Lahiru Kumara", "Michael Neser", "Richard Ngarava", "Wayne Parnell", 
          "Keemo Paul", "Odean Smith", "Andrew Tye", "Chris Green", "Zakary Foulkes"
        ]);

        const mappedCountry = overseasNames.has(data.Players.trim()) ? 'Overseas' : 'India';

        results.push({
          name: data.Players,
          role: mappedRole,
          country: mappedCountry, // Use the new Set-based logic
          basePrice: baseValue,
          isOverseas: mappedCountry === 'Overseas',
          image: 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png' // Fallback silhouette
        });
      })
      .on('end', async () => {
        try {
          const avgBase = validBaseCount > 0 ? Math.floor(totalBase / validBaseCount) : 5000000;
          
          // Fill missing base prices with average
          const processedPlayers = results.map(p => ({
            ...p,
            basePrice: p.basePrice || avgBase
          }));
          
          await Player.deleteMany({});
          await Player.insertMany(processedPlayers);
          console.log(`Players seeded successfully! Inserted ${processedPlayers.length} players. Avg Base: ${avgBase}`);
          resolve();
        } catch (error) {
          console.error('Error seeding players:', error);
          reject(error);
        }
      });
  });
};

module.exports = seedPlayers;
