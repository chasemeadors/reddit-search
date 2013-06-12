function SimplePost(origPost) {
    this.title = origPost.data.title
    this.date = moment.unix(origPost.data.created)
    this.rawTime = origPost.data.created
    this.comments = "http://www.reddit.com" + origPost.data.permalink
    this.link = origPost.data.url
    this.thumbnail = origPost.data.thumbnail
    this.subreddit = origPost.data.subreddit
    this.op = origPost.data.author

    this.domain = this.extractDomain(this.link)
    this.extension = this.extractExtension(this.link)
    if (this.extension == "") {
        this.extension == "No extension"
    }


    this.isKeyDate = false
}

SimplePost.prototype.extractDomain = function (url) {
    var tmp = document.createElement('a')
    tmp.href = this.link
    return tmp.hostname
}

SimplePost.prototype.extractExtension = function (url) {
    var end = url.substr(url.lastIndexOf("/"))
    return end.substr((Math.max(0, end.lastIndexOf(".")) || Infinity) + 1)
}

var app = angular.module('RedditSearch', [])

app.controller('AppController', ['$scope', '$http', function ($scope, $http) {

    // Temporarily holds the data in the form before submit is pressed (so it doesn't live update)
    $scope.form_data = {
        username: "",
        type: ""
    }

    // This gets copied over from form_data on beginSearch()
    $scope.data = {
        username: "",
        type: ""
    }

    // The filter object for the filter results panel
    $scope.postfilter = {
        subreddit: "",
        title: "",
        domain: "",
        op: "",
        extension: ""
    }


    // This re-initializes every variable needed for a brand new search
    $scope.reset = function () {
        $scope.posts.length = 0
        $scope.monthGroups.length = 0

        $scope.pagesSearched = 0
        $scope.postsSearched = 0
        $scope.reachedRedditLimit = false

        $scope.earliestDate = ""

        $scope._latestChildName = null

        $scope.error = null
    }


    // The main collection
    $scope.posts = []

    // This collection serves to group the main collection by month
    $scope.monthGroups = []

    // Tracks whether or not we're currently retrieving posts
    $scope._retrieveTimeout = null
    $scope._errorTimeout = null
    $scope._ajaxRequest = null

    // Reset now
    $scope.reset()

    $scope.isBusy = function () {
        return (($scope._retrieveTimeout != null) && !$scope.reachedRedditLimit)
    }

    $scope.updateSortingGrouping = function () {
        $scope.posts.sort(function (postA, postB) {
            return postB.rawTime - postA.rawTime
        })

        var i = 0
        $scope.monthGroups.length = 0
        var runningMonth = -1
        for (i = 0; i < $scope.posts.length; i ++) {
            if (runningMonth - $scope.posts[i].date.month() != 0) {
                var newgroup = {
                    month: $scope.posts[i].date.startOf('month'),
                    posts: []
                }
                $scope.monthGroups.push(newgroup)
            }

            runningMonth = $scope.posts[i].date.month()

            // Push the post to the latest monthGroup
            $scope.monthGroups[$scope.monthGroups.length - 1].posts.push($scope.posts[i])
        }
    }

    $scope.retrievePosts = function () {

        url = "http://www.reddit.com/user/" + $scope.data.username + "/" + $scope.data.type + ".json?jsonp=?&limit=100&sort=new"

        if ($scope._latestChildName) {
            url += "&after=" + $scope._latestChildName
        }

        $scope._ajaxRequest = $.getJSON(url, function (ret) {
            $scope.$apply(function () {

                if ($scope._errorTimeout) {
                    clearTimeout($scope._errorTimeout)
                    $scope._errorTimeout = null
                }

                if ($scope._ajaxRequest) {
                    $scope._ajaxRequest = null
                }


                var i = 0
                for (i = 0; i < ret.data.children.length; i ++) {

                    orig = ret.data.children[i]
                    
                    sp = new SimplePost(orig)
                    $scope.posts.push(sp)

                    $scope.updateSortingGrouping()
                }

                $scope.pagesSearched += 1
                $scope.postsSearched += ret.data.children.length
                
                // If it returned less than 100 items, that's the end of the road
                var lastindex = ret.data.children.length - 1
                if (lastindex < 99) {
                    $scope.reachedRedditLimit = true
                }

                // It might have some stuf in in though. If not, just return
                if (lastindex < 0) {
                    return
                }

                $scope._latestChildName = ret.data.children[lastindex].data.name

                $scope.earliestDate = $scope.posts[$scope.posts.length-1].date

                if (!$scope.reachedRedditLimit) {
                    $scope._retrieveTimeout = setTimeout(function () {
                        $scope.retrievePosts()  
                    }, 3000)
                }
            })
        
        })
    
        $scope._errorTimeout = setTimeout(function () {
            $scope.$apply(function () {
                $scope.error = "no_page"
                if ($scope._ajaxRequest) {
                    $scope._ajaxRequest.abort()
                    $scope._ajaxRequest = null
                    $scope.reachedRedditLimit = true
                }
            })
        }, 6000)

    }

    $scope.beginSearch = function () {
        
        // Commit form_data to the actual data array
        angular.copy($scope.form_data, $scope.data)

        $scope.reset()

        if ($scope._errorTimeout) {
            clearTimeout($scope._errorTimeout)
            $scope._errorTimeout = null
        }

        if ($scope._retrieveTimeout) {
            clearTimeout($scope._retrieveTimeout)
            $scope._retrieveTimeout = null
        }

        if ($scope._ajaxRequest) {
            $scope._ajaxRequest.abort()
            $scope._ajaxRequest = null
        }

        // If the timer is not currently repeatedly calling retrieve, start it up. 
        // It will keep itself going after the first call
        if (!$scope._retrieveTimeout) {
            $scope._retrieveTimeout = setTimeout(function () {
                $scope.retrievePosts()  
            }, 100)
        }
    }
}])
