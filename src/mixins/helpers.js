'use strict';

import React from 'react';
import ReactDOM from 'react-dom';
import ReactTransitionEvents from 'react/lib/ReactTransitionEvents';
import {getTrackCSS, getTrackLeft, getTrackAnimateCSS} from './trackHelper';
import assign from 'object-assign';

var helpers = {
  initialize: function (props) {
    this.update(
      props,
      this.autoPlay // once we're set up, trigger the initial autoplay.
    );
  },
  update: function (props, cb) {
    var slideCount = React.Children.count(props.children);
    var listWidth = this.getWidth(ReactDOM.findDOMNode(this.refs.list));
    var trackWidth = this.getWidth(ReactDOM.findDOMNode(this.refs.track));
    var slideWidth = this.getWidth(ReactDOM.findDOMNode(this))/props.slidesToShow;

    var currentSlide =
      this.state.currentSlide !== undefined ? this.state.currentSlide
      : props.rtl ? slideCount - 1 - props.initialSlide : props.initialSlide;

    this.lazyUpdate(currentSlide, props);
    this.setState({
      slideCount: slideCount,
      slideWidth: slideWidth,
      listWidth: listWidth,
      trackWidth: trackWidth,
      currentSlide: currentSlide
    }, function () {

      var targetLeft = getTrackLeft(assign({
        slideIndex: this.state.currentSlide,
        trackRef: this.refs.track
      }, props, this.state));
      // getCSS function needs previously set state
      var trackStyle = getTrackCSS(assign({left: targetLeft}, props, this.state));

      this.setState({trackStyle: trackStyle});
      cb && cb();
    });
  },
  lazyUpdate: function(currentSlide, props) {
    if (props.lazyLoad) {
      const lazyLoadedList = this.state.lazyLoadedList;
      const slidesToLoad = [];
      // TODO: Support infinite/centerMode.
      const end = Math.min(React.Children.count(props.children), currentSlide + props.slidesToShow);
      for (var i = currentSlide; i < end; i++) {
	if (lazyLoadedList.indexOf(i) < 0) {
          slidesToLoad.push(i);
	}
      }
      if (slidesToLoad.length) {
	this.setState({lazyLoadedList: lazyLoadedList.concat(slidesToLoad)});
      }
    }
  },
  getWidth: function getWidth(elem) {
    return elem.getBoundingClientRect().width || elem.offsetWidth;
  },
  adaptHeight: function () {
    if (this.props.adaptiveHeight) {
      var selector = '[data-index="' + this.state.currentSlide +'"]';
      if (this.refs.list) {
        var slickList = ReactDOM.findDOMNode(this.refs.list);
        slickList.style.height = slickList.querySelector(selector).offsetHeight + 'px';
      }
    }
  },
  slideHandler: function (index) {
    // Functionality of animateSlide and postSlide is merged into this function
    // console.log('slideHandler', index);
    var targetSlide, currentSlide;
    var targetLeft, currentLeft;
    var callback;

    if (this.props.waitForAnimate && this.state.animating) {
      return;
    }

    if (this.props.fade) {
      currentSlide = this.state.currentSlide;

      //  Shifting targetSlide back into the range
      if (index < 0) {
        targetSlide = index + this.state.slideCount;
      } else if (index >= this.state.slideCount) {
        targetSlide = index - this.state.slideCount;
      } else {
        targetSlide = index;
      }

      this.lazyUpdate(targetSlide, this.props);

      callback = () => {
        this.setState({
          animating: false
        });
        if (this.props.afterChange) {
          this.props.afterChange(currentSlide);
        }
        ReactTransitionEvents.removeEndEventListener(ReactDOM.findDOMNode(this.refs.track).children[currentSlide], callback);
      };

      this.setState({
        animating: true,
        currentSlide: targetSlide
      }, function () {
        ReactTransitionEvents.addEndEventListener(ReactDOM.findDOMNode(this.refs.track).children[currentSlide], callback);
      });

      if (this.props.beforeChange) {
        this.props.beforeChange(this.state.currentSlide, currentSlide);
      }

      this.autoPlay();
      return;
    }

    targetSlide = index;
    if (targetSlide < 0) {
      if(this.props.infinite === false) {
        currentSlide = 0;
      } else if (this.state.slideCount % this.props.slidesToScroll !== 0) {
        currentSlide = this.state.slideCount - (this.state.slideCount % this.props.slidesToScroll);
      } else {
        currentSlide = this.state.slideCount + targetSlide;
      }
    } else if (targetSlide >= this.state.slideCount) {
      if(this.props.infinite === false) {
        currentSlide = this.state.slideCount - this.props.slidesToShow;
      } else if (this.state.slideCount % this.props.slidesToScroll !== 0) {
        currentSlide = 0;
      } else {
        currentSlide = targetSlide - this.state.slideCount;
      }
    } else {
      currentSlide = targetSlide;
    }

    targetLeft = getTrackLeft(assign({
      slideIndex: targetSlide,
      trackRef: this.refs.track
    }, this.props, this.state));

    currentLeft = getTrackLeft(assign({
      slideIndex: currentSlide,
      trackRef: this.refs.track
    }, this.props, this.state));

    if (this.props.infinite === false) {
      targetLeft = currentLeft;
    }

    if (this.props.beforeChange) {
      this.props.beforeChange(this.state.currentSlide, currentSlide);
    }

    this.lazyUpdate(targetSlide, this.props);

    // Slide Transition happens here.
    // animated transition happens to target Slide and
    // non - animated transition happens to current Slide
    // If CSS transitions are false, directly go the current slide.

    if (this.props.useCSS === false) {

      this.setState({
        currentSlide: currentSlide,
        trackStyle: getTrackCSS(assign({left: currentLeft}, this.props, this.state))
      }, function () {
        if (this.props.afterChange) {
          this.props.afterChange(currentSlide);
        }
      });

    } else {

      var nextStateChanges = {
        animating: false,
        currentSlide: currentSlide,
        trackStyle: getTrackCSS(assign({left: currentLeft}, this.props, this.state)),
        swipeLeft: null
      };

      callback = () => {
        this.setState(nextStateChanges);
        if (this.props.afterChange) {
          this.props.afterChange(currentSlide);
        }
        ReactTransitionEvents.removeEndEventListener(ReactDOM.findDOMNode(this.refs.track), callback);
      };

      this.setState({
        animating: true,
        currentSlide: currentSlide,
        trackStyle: getTrackAnimateCSS(assign({left: targetLeft}, this.props, this.state))
      }, function () {
        ReactTransitionEvents.addEndEventListener(ReactDOM.findDOMNode(this.refs.track), callback);
      });

    }

    this.autoPlay();
  },
  swipeDirection: function (touchObject) {
    var xDist, yDist, r, swipeAngle;

    xDist = touchObject.startX - touchObject.curX;
    yDist = touchObject.startY - touchObject.curY;
    r = Math.atan2(yDist, xDist);

    swipeAngle = Math.round(r * 180 / Math.PI);
    if (swipeAngle < 0) {
        swipeAngle = 360 - Math.abs(swipeAngle);
    }
    if ((swipeAngle <= 45) && (swipeAngle >= 0) || (swipeAngle <= 360) && (swipeAngle >= 315)) {
        return (this.props.rtl === false ? 'left' : 'right');
    }
    if ((swipeAngle >= 135) && (swipeAngle <= 225)) {
        return (this.props.rtl === false ? 'right' : 'left');
    }

    return 'vertical';
  },
  autoPlay: function () {
    if (this.state.autoPlayTimer) {
      return;
    }
    var play = () => {
      if (this.state.mounted) {
        var nextIndex = this.props.rtl ?
        this.state.currentSlide - this.props.slidesToScroll:
        this.state.currentSlide + this.props.slidesToScroll;
        this.slideHandler(nextIndex);
      }
    };
    if (this.props.autoplay) {
      this.setState({
        autoPlayTimer: window.setInterval(play, this.props.autoplaySpeed)
      });
    }
  },
  pause: function () {
    if (this.state.autoPlayTimer) {
      window.clearInterval(this.state.autoPlayTimer);
      this.setState({
        autoPlayTimer: null
      });
    }
  }
};

export default helpers;
