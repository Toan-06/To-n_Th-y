const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const User = require('../models/User');
const Post = require('../models/Post');
const Group = require('../models/Group');
const Place = require('../models/Place');

async function testSearch() {
    try {
        await mongoose.connect(process.env.MONGODB_URI.trim());
        console.log("Connected");
        
        const query = "Minh";
        const searchRegex = new RegExp(query, 'i');

        console.log("Searching Users...");
        const users = await User.find({
            $or: [{ name: searchRegex }, { displayName: searchRegex }]
        }).select('name displayName avatar rank').limit(5);
        console.log("Users found:", users.length);

        console.log("Searching Posts...");
        const posts = await Post.find({
            $or: [{ content: searchRegex }, { 'location.name': searchRegex }]
        }).populate('userId', 'name avatar').limit(5);
        console.log("Posts found:", posts.length);

        console.log("Searching Groups...");
        const groups = await Group.find({
            $or: [{ name: searchRegex }, { description: searchRegex }]
        }).limit(8);
        console.log("Groups found:", groups.length);

        console.log("Searching Places...");
        const places = await Place.find({
            $or: [{ name: searchRegex }, { region: searchRegex }, { description: searchRegex }]
        }).limit(8);
        console.log("Places found:", places.length);

        process.exit(0);
    } catch (err) {
        console.error("CRASHED:", err);
        process.exit(1);
    }
}

testSearch();
